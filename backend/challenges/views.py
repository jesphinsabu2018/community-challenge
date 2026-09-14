from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .admin_auth import IsAdmin, authenticate_admin
from .models import AuditEvent, Challenge, Participation, PeerReview, Profile, ReviewAssignment, Submission, Vote
from .serializers import BlindReviewSerializer, ChallengeSerializer, ParticipationSerializer, PeerReviewSerializer, ProfileSerializer, SubmissionSerializer, VoteSerializer
from .security import PeerReviewThrottle, ReviewAssignmentPermission, SubmissionThrottle, VoteThrottle, ensure_review_assignment, hash_ip, device_fingerprint, stratified_assign, suspicious_review_pair
from .services import compute_merit_score, reviewer_trust_weight


class IsAuthenticatedOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS or bool(request.user and request.user.is_authenticated)


class ChallengeViewSet(viewsets.ModelViewSet):
    queryset = Challenge.objects.all()
    serializer_class = ChallengeSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_permissions(self):
        if self.action == 'create':
            return [IsAdmin()]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(creator_id=self.request.user.id)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def join(self, request, pk=None):
        challenge = self.get_object()
        participation, created = Participation.objects.get_or_create(user_id=request.user.id, challenge=challenge)
        if not created:
            return Response(ParticipationSerializer(participation).data, status=status.HTTP_200_OK)
        return Response(ParticipationSerializer(participation).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated], url_path='submit')
    def submit(self, request, pk=None):
        challenge = self.get_object()
        participation = get_object_or_404(Participation, challenge=challenge, user_id=request.user.id)
        serializer = SubmissionSerializer(data={
            'participation': participation.pk,
            'payload': request.data.get('payload', {}),
        })
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                submission = serializer.save()
                participation.status = Participation.Status.COMPLETED
                participation.save(update_fields=['status'])
                compute_merit_score(submission)
                AuditEvent.objects.create(
                    event_type='submission_created', actor_id=request.user.id, submission=submission,
                    ip_hash=hash_ip(request), device_fingerprint=device_fingerprint(request),
                    metadata={'challenge_id': str(challenge.id)},
                )
                reviewer_ids = Participation.objects.filter(challenge=challenge).exclude(
                    user_id=request.user.id
                ).values_list('user_id', flat=True)
                stratified_assign(submission, reviewer_ids)
        except IntegrityError as error:
            raise serializers.ValidationError('This participation already has a submission.') from error
        return Response(SubmissionSerializer(submission).data, status=status.HTTP_201_CREATED)

    def get_throttles(self):
        return [SubmissionThrottle()] if self.action == 'submit' else super().get_throttles()


class ParticipationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ParticipationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Participation.objects.filter(user_id=self.request.user.id).select_related('challenge')


class SubmissionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SubmissionSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    queryset = Submission.objects.select_related('participation', 'participation__challenge').all()


class PeerReviewViewSet(viewsets.ModelViewSet):
    serializer_class = PeerReviewSerializer
    permission_classes = [permissions.IsAuthenticated, ReviewAssignmentPermission]
    queryset = PeerReview.objects.select_related('submission', 'submission__participation').all()

    def get_throttles(self):
        return [PeerReviewThrottle()] if self.action == 'create' else super().get_throttles()

    def get_queryset(self):
        return super().get_queryset().filter(reviewer_id=self.request.user.id)

    def perform_create(self, serializer):
        submission = serializer.validated_data['submission']
        assignment = ensure_review_assignment(submission, self.request.user.id)
        if suspicious_review_pair(self.request.user.id, submission.participation.user_id):
            from .models import AnomalyFlag
            AnomalyFlag.objects.get_or_create(
                kind='mutual_review_pattern', subject_id=self.request.user.id,
                defaults={'submission': submission, 'severity': 3, 'evidence': {'author_id': str(submission.participation.user_id)}},
            )
        weight = reviewer_trust_weight(self.request.user.id)
        review = serializer.save(reviewer_id=self.request.user.id, reviewer_trust_weight=weight)
        assignment.status = ReviewAssignment.Status.COMPLETED
        assignment.save(update_fields=['status'])
        AuditEvent.objects.create(
            event_type='peer_review_created', actor_id=self.request.user.id, submission=submission,
            ip_hash=hash_ip(self.request), device_fingerprint=device_fingerprint(self.request),
            metadata={'assignment_id': str(assignment.id), 'blind': True},
        )
        compute_merit_score(review.submission)


class ReviewAssignmentViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = BlindReviewSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Submission.objects.filter(
            review_assignments__reviewer_id=self.request.user.id,
            review_assignments__status=ReviewAssignment.Status.ASSIGNED,
        ).distinct()


class VoteViewSet(viewsets.ModelViewSet):
    serializer_class = VoteSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Vote.objects.all()

    def get_throttles(self):
        return [VoteThrottle()] if self.action == 'create' else super().get_throttles()

    def perform_create(self, serializer):
        submission = serializer.validated_data['submission']
        if submission.participation.user_id == self.request.user.id:
            raise serializers.ValidationError({'submission': 'You cannot vote for your own submission.'})
        try:
            vote = serializer.save(voter_id=self.request.user.id)
        except IntegrityError as error:
            raise serializers.ValidationError({'submission': 'You have already voted for this submission.'}) from error
        AuditEvent.objects.create(
            event_type='vote_created', actor_id=self.request.user.id, submission=submission,
            ip_hash=hash_ip(self.request), device_fingerprint=device_fingerprint(self.request),
            metadata={'vote_id': str(vote.id)},
        )


class ChallengeLeaderboardView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, challenge_id):
        get_object_or_404(Challenge, pk=challenge_id)
        submissions = Submission.objects.filter(
            participation__challenge_id=challenge_id,
            merit_score__isnull=False,
        ).select_related('participation').order_by('-merit_score', 'submitted_at')
        return Response([
            {
                'rank': index,
                'submission_id': str(submission.id),
                'participation_id': str(submission.participation_id),
                'user_id': str(submission.participation.user_id),
                'merit_score': float(submission.merit_score),
                'submitted_at': submission.submitted_at,
            }
            for index, submission in enumerate(submissions, start=1)
        ])


class ProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_profile(self, request, user_id):
        profile, _ = Profile.objects.get_or_create(
            id=user_id,
            defaults={'username': f'user_{str(user_id)[:8]}'},
        )
        return profile

    def get(self, request, user_id):
        return Response(ProfileSerializer(self.get_profile(request, user_id)).data)

    def patch(self, request, user_id):
        if str(request.user.id) != str(user_id):
            return Response({'detail': 'You can only update your own profile.'}, status=status.HTTP_403_FORBIDDEN)
        profile = self.get_profile(request, user_id)
        serializer = ProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class AdminLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        token = authenticate_admin(request.data.get('username', ''), request.data.get('password', ''))
        if not token:
            return Response({'detail': 'Invalid administrator credentials.'}, status=status.HTTP_401_UNAUTHORIZED)
        return Response({'token': token, 'username': request.data.get('username', '')})


class AdminDashboardView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        from .models import AnomalyFlag, AuditEvent
        return Response({
            'challenge_count': Challenge.objects.count(),
            'submission_count': Submission.objects.count(),
            'open_anomaly_count': AnomalyFlag.objects.filter(status=AnomalyFlag.Status.OPEN).count(),
            'recent_events': list(AuditEvent.objects.order_by('-created_at').values(
                'event_type', 'actor_id', 'created_at', 'metadata'
            )[:25]),
        })

from datetime import timedelta

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone
from rest_framework import status, throttling
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Challenge, Comment, Participant, Profile, Report, ScoreAuditLog, Submission, Vote
from .scoring_engine import calculate_score


class SubmissionThrottle(throttling.UserRateThrottle):
    scope = 'submission'


class VoteThrottle(throttling.UserRateThrottle):
    scope = 'vote'


def profile_data(profile):
    return {
        'id': str(profile.id), 'username': profile.username, 'avatar_url': profile.avatar_url, 'bio': profile.bio,
        'is_moderator': profile.is_moderator, 'challenges_joined': profile.challenges_joined,
        'challenges_completed': profile.challenges_completed, 'challenges_in_progress': profile.challenges_in_progress,
        'challenges_failed': profile.challenges_failed, 'average_score': float(profile.average_score),
        'consistency_streak': profile.consistency_streak, 'created_at': profile.created_at,
    }


def challenge_data(challenge):
    return {field: getattr(challenge, field) for field in (
        'id', 'creator_id', 'title', 'description', 'rules', 'category', 'difficulty_tier', 'difficulty_weight',
        'submission_type', 'evaluation_criteria', 'benchmark_value', 'benchmark_unit', 'deadline',
        'requires_verification', 'participant_count', 'created_at')}


def submission_data(submission):
    return {
        'id': str(submission.id), 'user_id': str(submission.user_id), 'challenge_id': str(submission.challenge_id),
        'submission_payload': submission.submission_payload, 'file_url': submission.file_url, 'file_hash': submission.file_hash,
        'raw_performance_score': submission.raw_performance_score, 'verification_status': submission.verification_status,
        'submitted_at': submission.submitted_at, 'vote_count': submission.votes.count(),
    }


def ensure_profile(user_id, claims=None):
    profile, _ = Profile.objects.get_or_create(
        id=user_id,
        defaults={'username': (claims or {}).get('user_metadata', {}).get('username', f'user_{str(user_id)[:8]}')},
    )
    return profile


def recompute_submission(submission):
    profile = ensure_profile(submission.user_id)
    result = calculate_score(
        challenge=submission.challenge,
        submission=submission,
        consistency_streak=profile.consistency_streak,
        vote_count=submission.votes.count(),
        cohort_size=submission.challenge.submissions.count(),
    )
    details = result.breakdown
    ScoreAuditLog.objects.create(
        submission=submission, computed_final_score=result.final_score,
        performance_normalized=details['performance_normalized'], difficulty_weight=details['difficulty_weight'],
        completion_factor=details['completion_factor'], verification_factor=details['verification_factor'],
        consistency_bonus=details['consistency_bonus'], community_signal_capped=details['community_signal_capped'],
        breakdown=details,
    )
    return result


class ChallengeListView(APIView):
    def get(self, request):
        section = request.query_params.get('section', 'active')
        challenges = Challenge.objects.all()
        if section == 'new':
            challenges = challenges.order_by('-created_at')
        elif section in {'active', 'popular'}:
            challenges = challenges.order_by('-participant_count', '-created_at')
        return Response([challenge_data(item) for item in challenges[:50]])

    def post(self, request):
        payload = request.data
        required = ('title', 'category', 'difficulty_tier', 'submission_type')
        if any(not payload.get(field) for field in required):
            raise ValidationError('title, category, difficulty_tier, and submission_type are required.')
        challenge = Challenge.objects.create(
            creator_id=request.user.id, title=payload['title'], description=payload.get('description', ''),
            rules=payload.get('rules', ''), category=payload['category'], difficulty_tier=payload['difficulty_tier'],
            difficulty_weight=payload.get('difficulty_weight', {'Easy': 1, 'Medium': 1.3, 'Hard': 1.6, 'Expert': 2}.get(payload['difficulty_tier'], 1)),
            submission_type=payload['submission_type'], evaluation_criteria=payload.get('evaluation_criteria', {}),
            benchmark_value=payload.get('benchmark_value'), benchmark_unit=payload.get('benchmark_unit'),
            deadline=payload.get('deadline'), requires_verification=payload.get('requires_verification', True),
        )
        return Response(challenge_data(challenge), status=status.HTTP_201_CREATED)


class ChallengeDetailView(APIView):
    def get_object(self, challenge_id):
        try:
            return Challenge.objects.get(id=challenge_id)
        except Challenge.DoesNotExist:
            raise ValidationError('Challenge not found.')

    def get(self, request, challenge_id):
        return Response(challenge_data(self.get_object(challenge_id)))


class JoinChallengeView(APIView):
    def post(self, request, challenge_id):
        challenge = Challenge.objects.get(id=challenge_id)
        participant, created = Participant.objects.get_or_create(user_id=request.user.id, challenge=challenge)
        if not created:
            return Response({'detail': 'Already joined.'}, status=status.HTTP_409_CONFLICT)
        Profile.objects.filter(id=request.user.id).update(challenges_joined=F('challenges_joined') + 1)
        return Response({'status': participant.status}, status=status.HTTP_201_CREATED)


class ParticipantStatusView(APIView):
    def get(self, request, challenge_id):
        participant = Participant.objects.filter(user_id=request.user.id, challenge_id=challenge_id).first()
        return Response({'status': participant.status if participant else None})


class SubmissionListView(APIView):
    throttle_classes = [SubmissionThrottle]

    def get(self, request, challenge_id):
        return Response([submission_data(item) for item in Submission.objects.filter(challenge_id=challenge_id).order_by('-submitted_at')])

    def post(self, request, challenge_id):
        challenge = Challenge.objects.get(id=challenge_id)
        if not Participant.objects.filter(user_id=request.user.id, challenge=challenge).exists():
            raise ValidationError('Join the challenge before submitting proof.')
        payload = request.data.get('submission_payload', {})
        file_hash = request.data.get('file_hash')
        if file_hash and Submission.objects.filter(file_hash=file_hash).exclude(user_id=request.user.id, challenge=challenge).exists():
            raise ValidationError('This proof matches an existing submission and has been blocked as a duplicate.')
        try:
            with transaction.atomic():
                submission = Submission.objects.create(user_id=request.user.id, challenge=challenge, submission_payload=payload, file_url=request.data.get('file_url'), file_hash=file_hash)
                Participant.objects.filter(user_id=request.user.id, challenge=challenge).update(status='completed')
                recompute_submission(submission)
        except IntegrityError as error:
            raise ValidationError('You already have a submission for this challenge.') from error
        return Response(submission_data(submission), status=status.HTTP_201_CREATED)


class MySubmissionListView(APIView):
    def get(self, request):
        return Response([submission_data(item) for item in Submission.objects.filter(user_id=request.user.id).order_by('-submitted_at')])


class VoteView(APIView):
    throttle_classes = [VoteThrottle]

    def post(self, request, submission_id):
        try:
            submission = Submission.objects.select_related('challenge').get(id=submission_id)
        except Submission.DoesNotExist:
            raise ValidationError('Submission not found.')
        if submission.user_id == request.user.id:
            raise ValidationError('Self-voting is not allowed.')
        since = timezone.now() - timedelta(days=1)
        if Vote.objects.filter(voter_id=request.user.id, created_at__gte=since).count() >= settings.VOTE_DAILY_LIMIT:
            raise ValidationError('Daily vote limit reached.')
        if Vote.objects.filter(voter_id=request.user.id, submission__challenge=submission.challenge, created_at__gte=since).count() >= settings.VOTE_CHALLENGE_LIMIT:
            raise ValidationError('Challenge vote limit reached.')
        try:
            Vote.objects.create(voter_id=request.user.id, submission=submission)
        except IntegrityError as error:
            raise ValidationError('You have already voted for this submission.') from error
        recompute_submission(submission)
        return Response({'vote_count': submission.votes.count()}, status=status.HTTP_201_CREATED)

    def delete(self, request, submission_id):
        Vote.objects.filter(voter_id=request.user.id, submission_id=submission_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class VoteListView(APIView):
    def get(self, request, submission_id):
        return Response([{'id': str(vote.id), 'voter_id': str(vote.voter_id), 'submission_id': str(vote.submission_id), 'created_at': vote.created_at} for vote in Vote.objects.filter(submission_id=submission_id)])


class ReportView(APIView):
    def post(self, request, submission_id):
        try:
            report = Report.objects.create(reporter_id=request.user.id, submission_id=submission_id, reason=request.data.get('reason', ''))
        except IntegrityError as error:
            raise ValidationError('You have already reported this submission.') from error
        Submission.objects.filter(id=submission_id).update(verification_status='flagged')
        return Response({'id': str(report.id), 'status': report.status}, status=status.HTTP_201_CREATED)


class ModerationReportsView(APIView):
    def get(self, request):
        if not Profile.objects.filter(id=request.user.id, is_moderator=True).exists():
            return Response({'detail': 'Moderator access required.'}, status=status.HTTP_403_FORBIDDEN)
        return Response([{
            'id': str(report.id), 'reporter_id': str(report.reporter_id), 'submission_id': str(report.submission_id),
            'reason': report.reason, 'status': report.status, 'created_at': report.created_at,
            'username': ensure_profile(report.reporter_id).username, 'submission_payload': report.submission.submission_payload,
        } for report in Report.objects.select_related('submission').order_by('-created_at')])


class ModerationReportStatusView(APIView):
    def patch(self, request, report_id):
        if not Profile.objects.filter(id=request.user.id, is_moderator=True).exists():
            return Response({'detail': 'Moderator access required.'}, status=status.HTTP_403_FORBIDDEN)
        report = Report.objects.get(id=report_id)
        report.status = request.data.get('status', report.status)
        report.save(update_fields=['status'])
        return Response({'status': report.status})


class ModerationVerificationView(APIView):
    def patch(self, request, submission_id):
        if not Profile.objects.filter(id=request.user.id, is_moderator=True).exists():
            return Response({'detail': 'Moderator access required.'}, status=status.HTTP_403_FORBIDDEN)
        submission = Submission.objects.get(id=submission_id)
        submission.verification_status = request.data.get('status', submission.verification_status)
        submission.save(update_fields=['verification_status'])
        recompute_submission(submission)
        return Response(submission_data(submission))


class LeaderboardView(APIView):
    def get(self, request, challenge_id=None):
        submissions = Submission.objects.select_related('challenge').filter(verification_status__in=['verified', 'pending'] if challenge_id else ['verified', 'pending'])
        if challenge_id:
            submissions = submissions.filter(challenge_id=challenge_id)
        entries = []
        for submission in submissions:
            audit = submission.score_audits.first() or recompute_submission(submission)
            entries.append({'submission_id': str(submission.id), 'user_id': str(submission.user_id), 'final_score': float(audit.computed_final_score), 'verification_status': submission.verification_status, 'breakdown': audit.breakdown})
        return Response(sorted(entries, key=lambda item: item['final_score'], reverse=True))


class ScoreBreakdownView(APIView):
    def get(self, request, submission_id):
        audit = ScoreAuditLog.objects.filter(submission_id=submission_id).first()
        if not audit:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response({'submission_id': str(submission_id), 'final_score': float(audit.computed_final_score), **audit.breakdown, 'computed_at': audit.computed_at})


class ProfileView(APIView):
    def get(self, request, user_id):
        return Response(profile_data(ensure_profile(user_id)))

    def patch(self, request, user_id):
        if str(request.user.id) != str(user_id):
            return Response({'detail': 'You can only update your own profile.'}, status=status.HTTP_403_FORBIDDEN)
        profile = ensure_profile(user_id)
        for field in ('username', 'avatar_url', 'bio'):
            if field in request.data:
                setattr(profile, field, request.data[field])
        profile.save(update_fields=['username', 'avatar_url', 'bio'])
        return Response(profile_data(profile))


class ProfileByUsernameView(APIView):
    def get(self, request, username):
        try:
            profile = Profile.objects.get(username=username)
        except Profile.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(profile_data(profile))


class CommentView(APIView):
    def post(self, request, submission_id):
        submission = Submission.objects.get(id=submission_id)
        if submission.user_id == request.user.id and request.data.get('endorsement', False):
            raise ValidationError('You cannot endorse your own submission.')
        comment = Comment.objects.create(user_id=request.user.id, submission=submission, text=request.data.get('text', '').strip())
        return Response({'id': str(comment.id), 'text': comment.text, 'created_at': comment.created_at}, status=status.HTTP_201_CREATED)
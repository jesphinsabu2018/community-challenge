from rest_framework import serializers

from .models import Challenge, Participation, PeerReview, Profile, Submission, Vote
from .schema_validation import validate_payload


class ChallengeSerializer(serializers.ModelSerializer):
    difficulty_tier = serializers.CharField(write_only=True, required=False)
    submission_type = serializers.CharField(write_only=True, required=False)
    evaluation_criteria = serializers.JSONField(write_only=True, required=False)
    rules = serializers.CharField(write_only=True, required=False, allow_blank=True)
    difficulty_weight = serializers.FloatField(write_only=True, required=False)
    points = serializers.IntegerField(required=False, min_value=1)
    benchmark_value = serializers.FloatField(write_only=True, required=False, allow_null=True)
    benchmark_unit = serializers.CharField(write_only=True, required=False, allow_null=True, allow_blank=True)
    requires_verification = serializers.BooleanField(write_only=True, required=False)

    class Meta:
        model = Challenge
        fields = '__all__'
        read_only_fields = ('id', 'creator_id', 'created_at')

    def to_internal_value(self, data):
        normalized = dict(data)
        if 'difficulty' not in normalized:
            normalized['difficulty'] = {
                'Easy': 1, 'Medium': 3, 'Hard': 4, 'Expert': 5,
            }.get(normalized.get('difficulty_tier'), 3)
        if 'scoring_method' not in normalized:
            normalized['scoring_method'] = 'numeric_threshold' if normalized.get('submission_type') == 'numeric' else 'peer_review'
        if 'submission_schema' not in normalized:
            criteria = normalized.get('evaluation_criteria') or {}
            normalized['submission_schema'] = {
                'type': 'object',
                'properties': {'value': {'type': 'number'}} if normalized.get('submission_type') == 'numeric' else {},
                'required': ['value'] if normalized.get('submission_type') == 'numeric' else [],
                'additionalProperties': True,
                'evaluation_criteria': criteria,
            }
        return super().to_internal_value(normalized)

    def create(self, validated_data):
        for legacy_field in (
            'difficulty_tier', 'submission_type', 'evaluation_criteria', 'rules',
            'difficulty_weight', 'benchmark_value', 'benchmark_unit', 'requires_verification',
        ):
            validated_data.pop(legacy_field, None)
        return super().create(validated_data)

    def to_representation(self, instance):
        result = super().to_representation(instance)
        tier = {1: 'Easy', 2: 'Easy', 3: 'Medium', 4: 'Hard', 5: 'Expert'}.get(instance.difficulty, 'Medium')
        result.update({
            'difficulty_tier': tier,
            'submission_type': 'numeric' if instance.scoring_method == 'numeric_threshold' else 'text',
            'evaluation_criteria': instance.submission_schema.get('evaluation_criteria', {}),
            'rules': '',
            'difficulty_weight': round(1 + (instance.difficulty - 1) * 0.25, 2),
            'benchmark_value': None,
            'benchmark_unit': None,
            'requires_verification': False,
            'participant_count': instance.participations.count(),
        })
        return result


class ParticipationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Participation
        fields = '__all__'
        read_only_fields = ('id', 'user_id', 'joined_at', 'status')


class SubmissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Submission
        fields = '__all__'
        read_only_fields = ('id', 'submitted_at', 'merit_score')

    def validate(self, attrs):
        participation = attrs.get('participation')
        if participation is None:
            raise serializers.ValidationError({'participation': 'This field is required.'})
        validate_payload(attrs.get('payload', {}), participation.challenge.submission_schema)
        return attrs


class PeerReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = PeerReview
        fields = '__all__'
        read_only_fields = ('id', 'reviewer_id', 'reviewer_trust_weight', 'created_at')


class BlindReviewSerializer(serializers.ModelSerializer):
    """Review assignment representation intentionally contains no author profile data."""
    class Meta:
        model = Submission
        fields = ('id', 'payload', 'submitted_at')
        read_only_fields = fields


class VoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vote
        fields = '__all__'
        read_only_fields = ('id', 'voter_id', 'created_at')


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'challenges_joined', 'challenges_completed', 'challenges_in_progress', 'challenges_failed', 'average_score', 'consistency_streak', 'is_moderator')

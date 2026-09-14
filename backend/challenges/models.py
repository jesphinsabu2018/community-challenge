import uuid

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Profile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(max_length=80, unique=True)
    avatar_url = models.URLField(blank=True, null=True)
    bio = models.TextField(blank=True)
    is_moderator = models.BooleanField(default=False)
    challenges_joined = models.PositiveIntegerField(default=0)
    challenges_completed = models.PositiveIntegerField(default=0)
    challenges_in_progress = models.PositiveIntegerField(default=0)
    challenges_failed = models.PositiveIntegerField(default=0)
    average_score = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    consistency_streak = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'profiles'


class Challenge(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    creator_id = models.UUIDField()
    title = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    rules = models.TextField(blank=True)
    category = models.CharField(max_length=30)
    difficulty_tier = models.CharField(max_length=20)
    difficulty_weight = models.DecimalField(max_digits=3, decimal_places=2, default=1, validators=[MinValueValidator(1), MaxValueValidator(2)])
    submission_type = models.CharField(max_length=20)
    evaluation_criteria = models.JSONField(default=dict)
    benchmark_value = models.DecimalField(max_digits=12, decimal_places=3, null=True, blank=True)
    benchmark_unit = models.CharField(max_length=40, blank=True, null=True)
    deadline = models.DateTimeField(null=True, blank=True)
    requires_verification = models.BooleanField(default=True)
    participant_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'challenges'
        ordering = ['-created_at']


class Participant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.UUIDField()
    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE, db_column='challenge_id', related_name='participants')
    status = models.CharField(max_length=20, default='joined')
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'participants'
        constraints = [models.UniqueConstraint(fields=['user_id', 'challenge'], name='participants_user_challenge_unique')]


class Submission(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.UUIDField()
    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE, db_column='challenge_id', related_name='submissions')
    submission_payload = models.JSONField(default=dict)
    file_url = models.URLField(blank=True, null=True)
    file_hash = models.CharField(max_length=128, blank=True, null=True, db_index=True)
    raw_performance_score = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    verification_status = models.CharField(max_length=20, default='pending')
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'submissions'
        constraints = [models.UniqueConstraint(fields=['user_id', 'challenge'], name='submissions_user_challenge_unique')]


class Vote(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    voter_id = models.UUIDField()
    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, db_column='submission_id', related_name='votes')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'votes'
        constraints = [models.UniqueConstraint(fields=['voter_id', 'submission'], name='votes_voter_submission_unique')]


class Report(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reporter_id = models.UUIDField()
    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, db_column='submission_id', related_name='reports')
    reason = models.TextField(blank=True)
    status = models.CharField(max_length=20, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'reports'
        constraints = [models.UniqueConstraint(fields=['reporter_id', 'submission'], name='reports_reporter_submission_unique')]


class Comment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.UUIDField()
    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, db_column='submission_id', related_name='comments')
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'comments'


class ScoreAuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission = models.ForeignKey(Submission, on_delete=models.PROTECT, db_column='submission_id', related_name='score_audits')
    computed_final_score = models.DecimalField(max_digits=9, decimal_places=3)
    performance_normalized = models.DecimalField(max_digits=6, decimal_places=3)
    difficulty_weight = models.DecimalField(max_digits=4, decimal_places=3)
    completion_factor = models.DecimalField(max_digits=5, decimal_places=3)
    verification_factor = models.DecimalField(max_digits=5, decimal_places=3)
    consistency_bonus = models.DecimalField(max_digits=6, decimal_places=3)
    community_signal_capped = models.DecimalField(max_digits=6, decimal_places=3)
    breakdown = models.JSONField(default=dict)
    computed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'score_audit_log'
        ordering = ['-computed_at']
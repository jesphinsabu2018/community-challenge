from django.db.models import Avg

from .models import AnomalyFlag, ScoreAuditLog


def reviewer_trust_weight(reviewer_id):
    """Reduce influence for accounts with open security flags; never auto-bans."""
    flags = AnomalyFlag.objects.filter(subject_id=reviewer_id, status=AnomalyFlag.Status.OPEN)
    penalty = sum(flag.severity for flag in flags) * 0.1
    return max(0.1, round(1 - penalty, 3))


def compute_merit_score(submission):
    """Compute and persist a score outside serializers and request handlers."""
    challenge = submission.participation.challenge
    review_average = submission.peer_reviews.aggregate(value=Avg('score'))['value']
    weighted_reviews = [
        float(review.score) * float(review.reviewer_trust_weight)
        for review in submission.peer_reviews.all()
    ]
    weighted_average = sum(weighted_reviews) / sum(
        float(review.reviewer_trust_weight) for review in submission.peer_reviews.all()
    ) if weighted_reviews else 0
    if challenge.scoring_method == 'peer_review':
        score = weighted_average or review_average or 0
    elif challenge.scoring_method == 'numeric_threshold':
        score = float(submission.payload.get('value', submission.payload.get('distance', 0)))
    else:
        numeric_score = float(submission.payload.get('value', submission.payload.get('distance', 0)))
        score = (weighted_average + numeric_score) / 2

    submission.merit_score = round(float(score), 3)
    submission.save(update_fields=['merit_score'])
    ScoreAuditLog.objects.create(
        submission=submission,
        computed_final_score=submission.merit_score,
        breakdown={'method': challenge.scoring_method, 'trust_weighted': bool(weighted_reviews)},
    )
    return submission.merit_score

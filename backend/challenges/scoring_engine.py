from dataclasses import dataclass
from typing import Any

from django.conf import settings


def clamp(value: float, low: float = 0, high: float = 100) -> float:
    return max(low, min(high, float(value)))


class Evaluator:
    def evaluate(self, challenge, payload: dict[str, Any]) -> tuple[float, float, dict[str, Any]]:
        raise NotImplementedError


class NumericEvaluator(Evaluator):
    def evaluate(self, challenge, payload):
        value = float(payload.get('value', 0))
        benchmark = float(challenge.benchmark_value or challenge.evaluation_criteria.get('target', 0))
        if benchmark <= 0:
            return clamp(value), 1.0 if value > 0 else 0.0, {'value': value, 'benchmark': benchmark}
        higher_is_better = challenge.evaluation_criteria.get('direction', 'higher') == 'higher'
        ratio = value / benchmark if higher_is_better else benchmark / max(value, 0.0001)
        return clamp(ratio * 100), clamp(ratio), {'value': value, 'benchmark': benchmark, 'direction': challenge.evaluation_criteria.get('direction', 'higher')}


class RubricEvaluator(Evaluator):
    def evaluate(self, challenge, payload):
        criteria = challenge.evaluation_criteria.get('criteria', [])
        scores = payload.get('rubric_scores', {})
        if not criteria:
            return 0.0, 0.0, {'criteria': [], 'reason': 'No creator rubric configured'}
        total = sum(float(item.get('weight', 1)) for item in criteria)
        earned = sum(clamp(float(scores.get(item.get('key'), 0))) * float(item.get('weight', 1)) for item in criteria)
        normalized = earned / total if total else 0
        return clamp(normalized), clamp(normalized / 100), {'criteria': criteria, 'submitted_scores': scores}


class ChecklistEvaluator(Evaluator):
    def evaluate(self, challenge, payload):
        items = challenge.evaluation_criteria.get('items', [])
        completed = payload.get('completed_items', [])
        total = len(items)
        ratio = len(set(completed).intersection({item.get('key') for item in items})) / total if total else 0
        return clamp(ratio * 100), ratio, {'items': items, 'completed_items': completed}


EVALUATORS = {'numeric': NumericEvaluator(), 'quiz': NumericEvaluator(), 'text': RubricEvaluator(), 'file': RubricEvaluator(), 'photo': RubricEvaluator(), 'video': RubricEvaluator(), 'checklist': ChecklistEvaluator()}


@dataclass(frozen=True)
class ScoreResult:
    final_score: float
    breakdown: dict[str, Any]


def calculate_score(*, challenge, submission, consistency_streak: int, vote_count: int, cohort_size: int) -> ScoreResult:
    evaluator = EVALUATORS.get(challenge.submission_type, RubricEvaluator())
    raw, completion_factor, evaluator_details = evaluator.evaluate(challenge, submission.submission_payload)
    cohort_normalizer = max(1, cohort_size)
    performance = clamp((raw / 100) * 100)
    verification = {'verified': 1.0, 'pending': 0.45, 'rejected': 0.0, 'flagged': 0.0}.get(submission.verification_status, 0.25)
    if challenge.requires_verification and not submission.file_url and challenge.submission_type in {'file', 'photo', 'video'}:
        verification = min(verification, 0.2)
    consistency_bonus = min(settings.SCORE_CONSISTENCY_BONUS_CAP, max(0, consistency_streak) * 0.5)
    community_signal = min(settings.SCORE_COMMUNITY_CAP, (vote_count / cohort_normalizer) * settings.SCORE_COMMUNITY_CAP)
    achievement = (performance * float(challenge.difficulty_weight) * completion_factor * verification)
    final_score = achievement + consistency_bonus + community_signal
    return ScoreResult(round(final_score, 3), {
        'performance_normalized': round(performance, 3),
        'difficulty_weight': float(challenge.difficulty_weight),
        'completion_factor': round(completion_factor, 3),
        'verification_factor': round(verification, 3),
        'consistency_bonus': round(consistency_bonus, 3),
        'community_signal_capped': round(community_signal, 3),
        'community_signal_cap': settings.SCORE_COMMUNITY_CAP,
        'evaluator': challenge.submission_type,
        'evaluator_details': evaluator_details,
    })
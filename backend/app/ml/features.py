"""
CyberShield Ethiopia - ML Feature Extraction and Validation

Extracts non-sensitive, aggregated learning signals from player Journey progress.
Strictly prohibits PII, passwords, authentication tokens, URLs, or incident report data.
"""

from typing import Dict, List, Optional
from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator

FEATURE_NAMES = [
    "recent_accuracy",             # Rolling accuracy in recent window (0.0 - 1.0)
    "overall_accuracy",            # Lifetime accuracy across recorded attempts (0.0 - 1.0)
    "current_difficulty_level",    # Encoded current difficulty: 0.0=beg, 0.5=int, 1.0=adv
    "consecutive_correct_norm",    # Consecutive correct streak normalized [0.0, 1.0]
    "max_category_error_rate",     # Highest error rate across individual threat categories (0.0 - 1.0)
    "error_deficit_score",         # Maximum net mistakes (wrong - correct) in a single category [0.0, 1.0]
    "attempt_volume_norm",         # Total attempts normalized up to saturation [0.0, 1.0]
    "recent_trend",                # Recent momentum: late window vs early window [0.0, 1.0]
]

VALID_CATEGORIES = {
    "phishing", "sim_swap", "banking", "malware", "credentials", "social_eng", "general"
}
VALID_DIFFICULTIES = {"beginner", "intermediate", "advanced"}


class OutcomeEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")
    category: str = Field(max_length=32, default="general")
    difficulty: str = Field(max_length=16, default="beginner")
    is_correct: bool = True
    timestamp: Optional[str] = Field(default=None, max_length=64)

    @field_validator("category")
    @classmethod
    def sanitize_category(cls, v: str) -> str:
        clean = v.strip().lower()
        return clean if clean in VALID_CATEGORIES else "general"

    @field_validator("difficulty")
    @classmethod
    def sanitize_difficulty(cls, v: str) -> str:
        clean = v.strip().lower()
        return clean if clean in VALID_DIFFICULTIES else "beginner"


class CategoryStatsEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")
    attempts: int = Field(ge=0, default=0)
    correct: int = Field(ge=0, default=0)
    wrong: int = Field(ge=0, default=0)
    consecutive_correct: int = Field(ge=0, default=0, validation_alias=AliasChoices("consecutive_correct", "consecutiveCorrect"))


class DifficultyStatsEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")
    attempts: int = Field(ge=0, default=0)
    correct: int = Field(ge=0, default=0)
    wrong: int = Field(ge=0, default=0)


class JourneyLearningTelemetry(BaseModel):
    """
    Non-sensitive learning telemetry payload for adaptive ML recommendations.
    Never collects names, credentials, tokens, URLs, or free-form text.
    """
    model_config = ConfigDict(extra="forbid")
    recent_outcomes: List[OutcomeEntry] = Field(default_factory=list, max_length=50)
    category_stats: Dict[str, CategoryStatsEntry] = Field(default_factory=dict)
    difficulty_stats: Dict[str, DifficultyStatsEntry] = Field(default_factory=dict)
    total_xp: int = Field(ge=0, default=0)
    completed_count: int = Field(ge=0, default=0)
    current_difficulty: str = Field(default="beginner", max_length=16)

    @field_validator("current_difficulty")
    @classmethod
    def validate_curr_diff(cls, v: str) -> str:
        clean = v.strip().lower()
        return clean if clean in VALID_DIFFICULTIES else "beginner"


def extract_feature_vector(telemetry: JourneyLearningTelemetry) -> List[float]:
    """
    Transforms non-sensitive telemetry into an 8-dimensional normalized feature vector.
    Guarantees every feature is a valid finite float in [0.0, 1.0].
    """
    outcomes = telemetry.recent_outcomes
    cat_stats = telemetry.category_stats
    diff_stats = telemetry.difficulty_stats

    # 1. Recent accuracy (last 5 questions window, or 0.5 baseline if none)
    if outcomes:
        recent_window = outcomes[-5:]
        recent_correct = sum(1 for o in recent_window if o.is_correct)
        recent_acc = recent_correct / len(recent_window)
    else:
        recent_acc = 0.5

    # 2. Overall accuracy
    total_attempts = sum(s.attempts for s in diff_stats.values())
    total_correct = sum(s.correct for s in diff_stats.values())
    if total_attempts > 0:
        overall_acc = total_correct / total_attempts
    elif outcomes:
        overall_acc = sum(1 for o in outcomes if o.is_correct) / len(outcomes)
    else:
        overall_acc = 0.5

    # 3. Encoded difficulty level
    diff_map = {"beginner": 0.0, "intermediate": 0.5, "advanced": 1.0}
    diff_val = diff_map.get(telemetry.current_difficulty, 0.0)

    # 4. Consecutive correct streak (normalized up to 5)
    latest_consecutive = 0
    for o in reversed(outcomes):
        if o.is_correct:
            latest_consecutive += 1
        else:
            break
    consecutive_norm = min(latest_consecutive, 5) / 5.0

    # 5. Max category error rate across categories with >= 2 attempts
    max_cat_err = 0.0
    for s in cat_stats.values():
        if s.attempts >= 2:
            rate = s.wrong / s.attempts
            if rate > max_cat_err:
                max_cat_err = rate

    # 6. Max net error deficit (wrong - correct)
    max_deficit = 0
    for s in cat_stats.values():
        deficit = s.wrong - s.correct
        if deficit > max_deficit:
            max_deficit = deficit
    # Normalize deficit: 0 deficit = 0.0, 5+ deficit = 1.0
    deficit_norm = min(max_deficit, 5) / 5.0

    # 7. Total attempt volume normalized up to 20 attempts
    attempt_count = total_attempts if total_attempts > 0 else len(outcomes)
    volume_norm = min(attempt_count, 20) / 20.0

    # 8. Recent momentum / trend: last 3 vs prior 3
    if len(outcomes) >= 4:
        late = outcomes[-3:]
        prior = outcomes[-6:-3] if len(outcomes) >= 6 else outcomes[:-3]
        late_acc = sum(1 for o in late if o.is_correct) / len(late)
        prior_acc = sum(1 for o in prior if o.is_correct) / len(prior)
        # Difference in [-1.0, 1.0], scaled to [0.0, 1.0] where 0.5 = unchanged
        trend_norm = 0.5 + ((late_acc - prior_acc) * 0.5)
    else:
        trend_norm = 0.5

    # Bound and sanitize all features
    raw = [
        recent_acc,
        overall_acc,
        diff_val,
        consecutive_norm,
        max_cat_err,
        deficit_norm,
        volume_norm,
        trend_norm,
    ]

    features = []
    for val in raw:
        if val is None or not (val == val):  # check NaN
            val = 0.5
        features.append(max(0.0, min(1.0, float(val))))

    return features

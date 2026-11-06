"""
CyberShield Ethiopia - Adaptive Recommendation Service

Coordinates ML inference, feature extraction, confidence scoring,
and seamless fallback to the deterministic recommendation engine.
"""

from pathlib import Path
from typing import Dict, Optional, Tuple
from pydantic import BaseModel, ConfigDict

from .features import (
    JourneyLearningTelemetry,
    extract_feature_vector,
    FEATURE_NAMES,
)
from .model import SoftmaxClassifier
from .evaluator import DATASET_LIMITATION_STATEMENT
from .. import config

CONFIDENCE_THRESHOLD = 0.55  # Minimum probability threshold required to trust ML prediction
DEFAULT_MODEL_PATH = (
    Path(__file__).resolve().parents[1] / "data" / "ml_journey_recommender.json"
)

# Global in-memory model cache
_cached_model: Optional[SoftmaxClassifier] = None


def get_loaded_model(model_path: Optional[Path] = None) -> Optional[SoftmaxClassifier]:
    """Retrieves or loads the active machine learning model artifact."""
    global _cached_model
    if _cached_model is not None:
        return _cached_model

    path = model_path or DEFAULT_MODEL_PATH
    if path.is_file():
        try:
            _cached_model = SoftmaxClassifier.load(path)
            return _cached_model
        except Exception:
            return None
    return None


def set_cached_model(model: Optional[SoftmaxClassifier]) -> None:
    """Sets or clears the cached model in memory (useful for testing)."""
    global _cached_model
    _cached_model = model


CATEGORY_TO_MODULE_MAP: Dict[str, str] = {
    "phishing": "m1",
    "phishing_advance_fee": "m1",
    "credentials": "m2",
    "credential_harvesting_telecom": "m2",
    "password_safety": "m2",
    "banking": "m3",
    "fake_banking_bot": "m3",
    "sim_swap": "m3",
    "telecom_fraud": "m3",
    "telecom": "m3",
    "social_eng": "m3",
    "social_engineering": "m5",
    "malware": "m4",
    "malicious_apk": "m4",
    "malicious_apk_telegram": "m4",
    "general": "m5",
}


def determine_recommended_module_and_activity(
    difficulty: str,
    category: Optional[str],
    completed_count: int = 0,
    recent_accuracy: float = 0.5,
) -> Tuple[str, str]:
    """
    Maps recommended difficulty and category to a suitable CyberShield Ethiopia learning module (M1-M5)
    and learning activity (campaign_mission, practice_mission, daily_challenge, or arena).
    """
    # 1. Module mapping based on threat category
    cat_lower = (category or "").lower()
    if cat_lower and cat_lower in CATEGORY_TO_MODULE_MAP:
        rec_module = CATEGORY_TO_MODULE_MAP[cat_lower]
    elif "phish" in cat_lower:
        rec_module = "m1"
    elif "pass" in cat_lower or "cred" in cat_lower:
        rec_module = "m2"
    elif any(k in cat_lower for k in ("bank", "telecom", "sim", "fraud", "bot")):
        rec_module = "m3"
    elif "malware" in cat_lower or "apk" in cat_lower:
        rec_module = "m4"
    elif difficulty == "advanced":
        rec_module = "m4"
    elif difficulty == "intermediate":
        rec_module = "m2"
    else:
        rec_module = "m1" if completed_count < 2 else "m5"

    # 2. Activity mapping
    if completed_count < 4 and difficulty == "beginner":
        rec_activity = "campaign_mission"

    elif difficulty == "advanced" and recent_accuracy >= 0.8:
        rec_activity = "arena"
    else:
        rec_activity = "practice_mission"

    return rec_module, rec_activity


class RecommendationResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    recommended_difficulty: str
    recommended_category: Optional[str] = None
    recommended_module: str = "m5"
    recommended_activity: str = "practice_mission"
    engine: str  # "ml_softmax_v1" or "deterministic_fallback"
    confidence: float
    probabilities: Dict[str, float]
    reason: str
    features: Dict[str, float]
    offline_capable: bool = True
    dataset_limitation: str = DATASET_LIMITATION_STATEMENT


def _evaluate_deterministic_fallback(
    telemetry: JourneyLearningTelemetry,
) -> Tuple[str, Optional[str], str]:
    """
    Standard rule-based adaptive algorithm.
    Guarantees reliable progression even if the ML service is offline or unconfident.
    """
    outcomes = telemetry.recent_outcomes
    cat_stats = telemetry.category_stats
    diff_stats = telemetry.difficulty_stats

    # Rule 1: Insufficient history
    if not outcomes and not diff_stats:
        return "beginner", None, "insufficient_data"

    # Rule 2: Category remediation
    struggling_cat = None
    max_deficit = 0
    for cat, stats in cat_stats.items():
        if stats.wrong >= 2 and stats.wrong >= stats.correct:
            deficit = (stats.wrong - stats.correct) + (1 if stats.consecutive_correct == 0 else 0)
            if deficit > max_deficit:
                max_deficit = deficit
                struggling_cat = cat

    if struggling_cat:
        return "beginner", struggling_cat, "category_remediation"

    # Rule 3: Gradual difficulty progression
    beg = diff_stats.get("beginner")
    mid = diff_stats.get("intermediate")

    recent_window = outcomes[-3:] if len(outcomes) >= 3 else outcomes
    recent_correct = sum(1 for o in recent_window if o.is_correct)

    next_diff = "beginner"
    beg_correct = beg.correct if beg else 0
    mid_correct = mid.correct if mid else 0

    if beg_correct >= 2 and recent_correct >= 2:
        next_diff = "intermediate"

    if next_diff == "intermediate" and mid_correct >= 2 and recent_correct >= 2:
        next_diff = "advanced"

    total_recorded_attempts = sum(s.attempts for s in diff_stats.values()) if diff_stats else len(outcomes)
    reason = (
        "mastery_advanced"
        if next_diff == "advanced"
        else "mastery_intermediate"
        if next_diff == "intermediate"
        else "insufficient_attempts_to_advance"
        if (beg_correct < 2 or len(outcomes) < 2 or total_recorded_attempts < 2)
        else "mastery_beginner"
    )
    return next_diff, None, reason


def get_adaptive_recommendation(
    telemetry: JourneyLearningTelemetry,
    model_path: Optional[Path] = None,
    enabled: Optional[bool] = None,
) -> RecommendationResponse:
    """
    Generates a personalized Journey learning recommendation.
    Tries genuine ML model inference first when enabled; safely falls back to deterministic rule engine
    if ML is disabled (the default), the model is missing, inputs are invalid, or prediction confidence is below threshold.
    """
    feature_vector = extract_feature_vector(telemetry)
    feature_dict = {
        name: round(val, 4) for name, val in zip(FEATURE_NAMES, feature_vector)
    }

    # Guard 0: Check if ML is enabled (disabled by default)
    is_enabled = getattr(config, "ML_RECOMMENDATIONS_ENABLED", False) if enabled is None else enabled
    if not is_enabled:
        fb_diff, fb_cat, fb_reason = _evaluate_deterministic_fallback(telemetry)
        rec_mod, rec_act = determine_recommended_module_and_activity(
            fb_diff, fb_cat, telemetry.completed_count, feature_dict.get("recent_accuracy", 0.5)
        )
        return RecommendationResponse(
            recommended_difficulty=fb_diff,
            recommended_category=fb_cat,
            recommended_module=rec_mod,
            recommended_activity=rec_act,
            engine="deterministic_fallback",
            confidence=1.0,
            probabilities={
                "beginner": round(1.0 if fb_diff == "beginner" else 0.0, 4),
                "intermediate": round(1.0 if fb_diff == "intermediate" else 0.0, 4),
                "advanced": round(1.0 if fb_diff == "advanced" else 0.0, 4),
            },
            reason=f"fallback_ml_disabled ({fb_reason})",
            features=feature_dict,
            offline_capable=True,
        )

    model = get_loaded_model(model_path)

    # Guard 1: Zero learning history -> deterministic baseline
    total_recorded_attempts = sum(s.attempts for s in telemetry.difficulty_stats.values())
    if not telemetry.recent_outcomes and total_recorded_attempts == 0 and telemetry.completed_count == 0:
        fb_diff, fb_cat, fb_reason = _evaluate_deterministic_fallback(telemetry)
        rec_mod, rec_act = determine_recommended_module_and_activity(
            fb_diff, fb_cat, telemetry.completed_count, 0.5
        )
        return RecommendationResponse(
            recommended_difficulty=fb_diff,
            recommended_category=fb_cat,
            recommended_module=rec_mod,
            recommended_activity=rec_act,
            engine="deterministic_fallback",
            confidence=1.0,
            probabilities={"beginner": 1.0, "intermediate": 0.0, "advanced": 0.0},
            reason=f"fallback_deterministic_{fb_reason}",
            features=feature_dict,
            offline_capable=True,
        )

    # Check for struggling category with exact parity to rule-based remediation
    struggling_cat = None
    max_deficit = 0
    for cat, stats in telemetry.category_stats.items():
        if stats.wrong >= 2 and stats.wrong >= stats.correct:
            deficit = (stats.wrong - stats.correct) + (1 if stats.consecutive_correct == 0 else 0)
            if deficit > max_deficit:
                max_deficit = deficit
                struggling_cat = cat

    # Case A: Model is active and ready
    if model is not None and model.trained:
        try:
            probs = model.predict_proba(feature_vector)
            best_diff, confidence = model.predict(feature_vector)

            # If confidence meets threshold, trust the ML recommendation
            if confidence >= CONFIDENCE_THRESHOLD:
                # Guard 2: Category remediation policy enforcement
                # When repeated mistakes occur in a threat category, pedagogical policy requires
                # foundational remediation at beginner difficulty in that category.
                if struggling_cat:
                    rec_diff = "beginner"
                    rec_cat = struggling_cat
                    rec_reason = f"ml_remediation_policy_for_{struggling_cat}"
                # Guard 3: Insufficient attempts to justify advancement
                elif (total_recorded_attempts < 2 and len(telemetry.recent_outcomes) < 2) and best_diff != "beginner":
                    rec_diff = "beginner"
                    rec_cat = None
                    rec_reason = "insufficient_attempts_to_advance"
                else:
                    rec_diff = best_diff
                    rec_cat = None
                    rec_reason = f"ml_predicted_{best_diff}_confidence_{round(confidence, 2)}"

                rec_mod, rec_act = determine_recommended_module_and_activity(
                    rec_diff, rec_cat, telemetry.completed_count, feature_dict.get("recent_accuracy", 0.5)
                )

                return RecommendationResponse(
                    recommended_difficulty=rec_diff,
                    recommended_category=rec_cat,
                    recommended_module=rec_mod,
                    recommended_activity=rec_act,
                    engine="ml_softmax_v1",
                    confidence=round(confidence, 4),
                    probabilities={c: round(p, 4) for c, p in probs.items()},
                    reason=rec_reason,
                    features=feature_dict,
                    offline_capable=True,
                )
            else:
                # Confidence below threshold -> fallback to deterministic
                fb_diff, fb_cat, fb_reason = _evaluate_deterministic_fallback(telemetry)
                rec_mod, rec_act = determine_recommended_module_and_activity(
                    fb_diff, fb_cat, telemetry.completed_count, feature_dict.get("recent_accuracy", 0.5)
                )
                return RecommendationResponse(
                    recommended_difficulty=fb_diff,
                    recommended_category=fb_cat,
                    recommended_module=rec_mod,
                    recommended_activity=rec_act,
                    engine="deterministic_fallback",
                    confidence=round(confidence, 4),
                    probabilities={c: round(p, 4) for c, p in probs.items()},
                    reason=f"fallback_due_to_low_ml_confidence ({fb_reason})",
                    features=feature_dict,
                    offline_capable=True,
                )
        except Exception:
            # Safe catch-all to guarantee zero downtime
            pass

    # Case B: Model not present or uninitialized -> deterministic fallback
    fb_diff, fb_cat, fb_reason = _evaluate_deterministic_fallback(telemetry)
    rec_mod, rec_act = determine_recommended_module_and_activity(
        fb_diff, fb_cat, telemetry.completed_count, feature_dict.get("recent_accuracy", 0.5)
    )
    equal_prob = 1.0 / 3.0
    return RecommendationResponse(
        recommended_difficulty=fb_diff,
        recommended_category=fb_cat,
        recommended_module=rec_mod,
        recommended_activity=rec_act,
        engine="deterministic_fallback",
        confidence=1.0,
        probabilities={
            "beginner": round(1.0 if fb_diff == "beginner" else 0.0, 4),
            "intermediate": round(1.0 if fb_diff == "intermediate" else 0.0, 4),
            "advanced": round(1.0 if fb_diff == "advanced" else 0.0, 4),
        },
        reason=f"fallback_deterministic_{fb_reason}",
        features=feature_dict,
        offline_capable=True,
    )


def get_ml_status(model_path: Optional[Path] = None) -> dict:
    """Returns runtime telemetry on the ML subsystem."""
    model = get_loaded_model(model_path)
    ml_enabled = getattr(config, "ML_RECOMMENDATIONS_ENABLED", False)
    return {
        "status": "operational",
        "active_engine": "ml_softmax_v1" if (model and model.trained and ml_enabled) else "deterministic_fallback",
        "ml_enabled": ml_enabled,
        "model_loaded": bool(model and model.trained),
        "model_type": model.__class__.__name__ if model else None,
        "classes": model.classes if model else ["beginner", "intermediate", "advanced"],
        "num_features": len(FEATURE_NAMES),
        "feature_names": FEATURE_NAMES,
        "confidence_threshold": CONFIDENCE_THRESHOLD,
        "privacy_compliance": {
            "no_pii_collected": True,
            "no_passwords_processed": True,
            "no_urls_processed": True,
            "offline_inference_supported": True,
            "cloud_telemetry_disabled": True,
        },
        "dataset_limitation_statement": DATASET_LIMITATION_STATEMENT,
    }

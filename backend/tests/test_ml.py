"""
Unit and Integration Tests for CyberShield Ethiopia Machine Learning Subsystem
"""

import json
import math
import tempfile
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.ml.features import (
    JourneyLearningTelemetry,
    OutcomeEntry,
    CategoryStatsEntry,
    DifficultyStatsEntry,
    extract_feature_vector,
    FEATURE_NAMES,
)
from app.ml.model import SoftmaxClassifier, BaselinePriorClassifier
from app.ml.evaluator import (
    evaluate_classifier,
    compare_against_baseline,
    generate_synthetic_pipeline_dataset,
    DATASET_LIMITATION_STATEMENT,
)
from app.ml.service import (
    get_adaptive_recommendation,
    get_ml_status,
    set_cached_model,
)

client = TestClient(app, base_url="http://127.0.0.1:8000")


# ==============================================================================
# 1. Feature Extraction & Validation Tests
# ==============================================================================

def test_feature_extraction_dimension_and_bounds():
    telemetry = JourneyLearningTelemetry(
        recent_outcomes=[
            OutcomeEntry(category="phishing", difficulty="beginner", is_correct=True),
            OutcomeEntry(category="sim_swap", difficulty="beginner", is_correct=False),
            OutcomeEntry(category="phishing", difficulty="beginner", is_correct=True),
        ],
        category_stats={
            "phishing": CategoryStatsEntry(attempts=2, correct=2, wrong=0, consecutive_correct=1),
            "sim_swap": CategoryStatsEntry(attempts=1, correct=0, wrong=1, consecutive_correct=0),
        },
        difficulty_stats={
            "beginner": DifficultyStatsEntry(attempts=3, correct=2, wrong=1),
        },
        total_xp=200,
        completed_count=2,
        current_difficulty="beginner",
    )

    vec = extract_feature_vector(telemetry)
    assert len(vec) == 8
    assert len(vec) == len(FEATURE_NAMES)
    for val in vec:
        assert isinstance(val, float)
        assert 0.0 <= val <= 1.0
        assert not math.isnan(val)


def test_feature_extraction_empty_telemetry():
    telemetry = JourneyLearningTelemetry()
    vec = extract_feature_vector(telemetry)
    assert len(vec) == 8
    # Baseline defaults should be neutral
    assert vec[0] == 0.5  # recent_acc default
    assert vec[1] == 0.5  # overall_acc default
    assert vec[2] == 0.0  # beginner difficulty
    assert vec[3] == 0.0  # consecutive streak
    assert vec[4] == 0.0  # max category error
    assert vec[5] == 0.0  # deficit
    assert vec[6] == 0.0  # volume
    assert vec[7] == 0.5  # trend neutral


def test_feature_telemetry_extra_fields_forbidden():
    with pytest.raises(Exception):
        # Attempt to inject personal data or unvetted fields
        JourneyLearningTelemetry(
            user_name="John Doe",
            password_submitted="Secret123!",
        )


def test_feature_sanitization_unknown_category_and_difficulty():
    entry = OutcomeEntry(category="UNKNOWN_EXPLOIT", difficulty="NIGHTMARE", is_correct=True)
    assert entry.category == "general"
    assert entry.difficulty == "beginner"


# ==============================================================================
# 2. Machine Learning Model Training & Convergence Tests
# ==============================================================================

def test_softmax_classifier_training_and_convergence():
    X_train, y_train = generate_synthetic_pipeline_dataset(n_samples=120, seed=42)
    model = SoftmaxClassifier(
        classes=["beginner", "intermediate", "advanced"],
        feature_names=FEATURE_NAMES,
        learning_rate=0.1,
        l2_reg=0.001,
    )
    assert model.trained is False

    model.fit(X_train, y_train, epochs=100, batch_size=16, seed=42)
    assert model.trained is True
    assert len(model.train_loss_history) == 100
    # Final loss must be substantially lower than initial loss
    assert model.train_loss_history[-1] < model.train_loss_history[0]


def test_softmax_classifier_probabilities_sum_to_one():
    X_train, y_train = generate_synthetic_pipeline_dataset(n_samples=60, seed=123)
    model = SoftmaxClassifier()
    model.fit(X_train, y_train, epochs=50, seed=123)

    for x in X_train[:10]:
        probs = model.predict_proba(x)
        assert len(probs) == 3
        prob_sum = sum(probs.values())
        assert abs(prob_sum - 1.0) < 1e-6
        for p in probs.values():
            assert 0.0 <= p <= 1.0

        best_class, best_prob = model.predict(x)
        assert best_class in ["beginner", "intermediate", "advanced"]
        assert best_prob == max(probs.values())


def test_baseline_prior_classifier():
    y_train = ["beginner"] * 10 + ["intermediate"] * 20 + ["advanced"] * 70
    X_dummy = [[0.5] * 8 for _ in range(100)]
    baseline = BaselinePriorClassifier()
    baseline.fit(X_dummy, y_train)

    assert baseline.majority_class == "advanced"
    assert abs(baseline.priors["advanced"] - 0.7) < 1e-6
    pred, conf = baseline.predict([0.1] * 8)
    assert pred == "advanced"
    assert abs(conf - 0.7) < 1e-6


# ==============================================================================
# 3. Model Evaluation & Pipeline Metrics Tests
# ==============================================================================

def test_evaluation_pipeline_metrics():
    X_train, y_train = generate_synthetic_pipeline_dataset(n_samples=90, seed=1)
    X_test, y_test = generate_synthetic_pipeline_dataset(n_samples=30, seed=2)

    model = SoftmaxClassifier().fit(X_train, y_train, epochs=80, seed=1)
    metrics = evaluate_classifier(model, X_test, y_test)

    assert "accuracy" in metrics
    assert "macro_f1" in metrics
    assert "mean_log_loss" in metrics
    assert "confusion_matrix" in metrics
    assert 0.0 <= metrics["accuracy"] <= 1.0
    assert 0.0 <= metrics["macro_f1"] <= 1.0
    assert metrics["mean_log_loss"] >= 0.0


def test_comparison_against_baseline():
    X_train, y_train = generate_synthetic_pipeline_dataset(n_samples=90, seed=7)
    X_test, y_test = generate_synthetic_pipeline_dataset(n_samples=30, seed=8)

    model = SoftmaxClassifier().fit(X_train, y_train, epochs=80, seed=7)
    baseline = BaselinePriorClassifier().fit(X_train, y_train)

    comp = compare_against_baseline(model, baseline, X_test, y_test)
    assert "ml_accuracy" in comp
    assert "baseline_accuracy" in comp
    assert "accuracy_lift" in comp
    assert comp["ml_accuracy"] >= comp["baseline_accuracy"]


# ==============================================================================
# 4. Serialization & Deserialization Tests
# ==============================================================================

def test_model_serialization_roundtrip():
    X, y = generate_synthetic_pipeline_dataset(n_samples=40, seed=99)
    original = SoftmaxClassifier().fit(X, y, epochs=30, seed=99)

    with tempfile.TemporaryDirectory() as tmpdir:
        model_file = Path(tmpdir) / "test_model.json"
        original.save(model_file)
        assert model_file.is_file()

        loaded = SoftmaxClassifier.load(model_file)
        assert loaded.classes == original.classes
        assert loaded.num_features == original.num_features
        assert loaded.weights == original.weights
        assert loaded.biases == original.biases

        test_x = [0.2, 0.4, 0.0, 0.1, 0.8, 0.6, 0.3, 0.4]
        assert loaded.predict(test_x) == original.predict(test_x)
        assert loaded.predict_proba(test_x) == original.predict_proba(test_x)


# ==============================================================================
# 5. Service & Fallback Coordination Tests
# ==============================================================================

def test_service_with_active_model_recommends_ml():
    # Construct a high-performing student profile
    telemetry = JourneyLearningTelemetry(
        recent_outcomes=[OutcomeEntry(is_correct=True) for _ in range(5)],
        category_stats={"phishing": CategoryStatsEntry(attempts=5, correct=5, wrong=0, consecutive_correct=5)},
        difficulty_stats={"beginner": DifficultyStatsEntry(attempts=5, correct=5, wrong=0)},
        current_difficulty="intermediate",
    )

    rec = get_adaptive_recommendation(telemetry)
    assert rec.offline_capable is True
    assert rec.recommended_difficulty in ["beginner", "intermediate", "advanced"]
    assert rec.confidence >= 0.0
    assert sum(rec.probabilities.values()) > 0.99


def test_service_fallback_when_model_cleared():
    set_cached_model(None)  # Simulate model file missing
    dummy_path = Path("non_existent_model_file_xyz.json")

    # Learner with repeated mistakes in SIM swap
    telemetry = JourneyLearningTelemetry(
        recent_outcomes=[
            OutcomeEntry(category="sim_swap", is_correct=False),
            OutcomeEntry(category="sim_swap", is_correct=False),
        ],
        category_stats={
            "sim_swap": CategoryStatsEntry(attempts=2, correct=0, wrong=2, consecutive_correct=0),
        },
        difficulty_stats={
            "beginner": DifficultyStatsEntry(attempts=2, correct=0, wrong=2),
        },
        current_difficulty="beginner",
    )

    rec = get_adaptive_recommendation(telemetry, model_path=dummy_path)
    assert rec.engine == "deterministic_fallback"
    assert rec.recommended_difficulty == "beginner"
    assert rec.recommended_category == "sim_swap"
    assert "category_remediation" in rec.reason


# ==============================================================================
# 6. API Endpoints Integration Tests
# ==============================================================================

def test_api_ml_recommend_endpoint():
    payload = {
        "recent_outcomes": [
            {"category": "phishing", "difficulty": "beginner", "is_correct": True},
            {"category": "malware", "difficulty": "beginner", "is_correct": True},
        ],
        "category_stats": {
            "phishing": {"attempts": 3, "correct": 3, "wrong": 0, "consecutive_correct": 3},
            "malware": {"attempts": 2, "correct": 2, "wrong": 0, "consecutive_correct": 2},
        },
        "difficulty_stats": {
            "beginner": {"attempts": 5, "correct": 5, "wrong": 0},
        },
        "total_xp": 250,
        "completed_count": 2,
        "current_difficulty": "beginner",
    }

    r = client.post("/api/v1/ml/recommend", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "recommended_difficulty" in data
    assert data["recommended_difficulty"] in ["beginner", "intermediate", "advanced"]
    assert "recommended_module" in data
    assert data["recommended_module"] in ["m1", "m2", "m3", "m4", "m5"]
    assert "recommended_activity" in data
    assert data["recommended_activity"] in ["campaign_mission", "practice_mission", "daily_challenge", "arena"]
    assert "engine" in data
    assert "confidence" in data
    assert "probabilities" in data
    assert "features" in data
    assert len(data["features"]) == 8
    assert data["offline_capable"] is True


def test_api_ml_status_endpoint():
    r = client.get("/api/v1/ml/status")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["status"] == "operational"
    assert data["num_features"] == 8
    assert data["privacy_compliance"]["no_pii_collected"] is True
    assert data["privacy_compliance"]["offline_inference_supported"] is True
    assert "dataset_limitation_statement" in data


def test_service_zero_learning_history_returns_deterministic_beginner():
    telemetry = JourneyLearningTelemetry()
    rec = get_adaptive_recommendation(telemetry)
    assert rec.engine == "deterministic_fallback"
    assert rec.recommended_difficulty == "beginner"
    assert "insufficient_data" in rec.reason


def test_service_category_remediation_policy_enforced():
    # Repeated mistakes in a category must be remediated at beginner difficulty
    telemetry = JourneyLearningTelemetry(
        recent_outcomes=[
            OutcomeEntry(category="sim_swap", difficulty="intermediate", is_correct=False),
            OutcomeEntry(category="sim_swap", difficulty="intermediate", is_correct=False),
        ],
        category_stats={
            "sim_swap": CategoryStatsEntry(attempts=2, correct=0, wrong=2, consecutive_correct=0),
        },
        difficulty_stats={
            "intermediate": DifficultyStatsEntry(attempts=2, correct=0, wrong=2),
        },
        current_difficulty="intermediate",
    )
    rec = get_adaptive_recommendation(telemetry)
    assert rec.recommended_difficulty == "beginner"
    assert rec.recommended_category == "sim_swap"
    assert "remediation" in rec.reason


def test_service_insufficient_attempts_blocks_advancement():
    # Only 1 attempt total - cannot advance to intermediate or advanced
    telemetry = JourneyLearningTelemetry(
        recent_outcomes=[
            OutcomeEntry(category="phishing", difficulty="beginner", is_correct=True),
        ],
        category_stats={
            "phishing": CategoryStatsEntry(attempts=1, correct=1, wrong=0, consecutive_correct=1),
        },
        difficulty_stats={
            "beginner": DifficultyStatsEntry(attempts=1, correct=1, wrong=0),
        },
        current_difficulty="beginner",
    )
    rec = get_adaptive_recommendation(telemetry)
    assert rec.recommended_difficulty == "beginner"
    assert "insufficient_attempts" in rec.reason


def test_api_ml_recommend_invalid_payload_safe_fallback():
    # Unexpected fields or malformed data should fail validation safely (HTTP 400/422)
    bad_payload = {"unexpected_key": "injected_value", "total_xp": "not_an_int"}
    r = client.post("/api/v1/ml/recommend", json=bad_payload)
    assert r.status_code in [400, 422]


def test_service_module_and_activity_mapping():
    from app.ml.service import determine_recommended_module_and_activity
    # Phishing -> M1 Link Scanner
    m_phish, act_phish = determine_recommended_module_and_activity("beginner", "phishing", completed_count=1)
    assert m_phish == "m1"
    assert act_phish == "campaign_mission"

    # Password / credentials -> M2 Crypto Vault
    m_pw, act_pw = determine_recommended_module_and_activity("beginner", "credentials", completed_count=4)
    assert m_pw == "m2"
    assert act_pw == "practice_mission"

    # SIM swap / Banking -> M3 Incident Dossier
    m_sim, act_sim = determine_recommended_module_and_activity("intermediate", "sim_swap", completed_count=4)
    assert m_sim == "m3"

    # Malware -> M4 Simulation
    m_mal, act_mal = determine_recommended_module_and_activity("advanced", "malware", completed_count=4, recent_accuracy=0.9)
    assert m_mal == "m4"
    assert act_mal == "arena"

    # General -> M5 Cyber Academy
    m_gen, act_gen = determine_recommended_module_and_activity("beginner", "general", completed_count=4)
    assert m_gen == "m5"
    assert act_gen == "practice_mission"


def test_model_artifact_and_frontend_mirror_parity():
    from app.ml.train_and_export import verify_consistency
    ok, details = verify_consistency()
    assert ok is True
    assert details["max_weight_diff"] < 1e-9
    assert details["max_bias_diff"] < 1e-9
    assert details["classes_match"] is True


def test_ml_recommendations_disabled_by_default():
    status = get_ml_status()
    assert status["ml_enabled"] is False
    assert status["active_engine"] == "deterministic_fallback"

    telemetry = JourneyLearningTelemetry(
        recent_outcomes=[OutcomeEntry(is_correct=True) for _ in range(5)],
        category_stats={"phishing": CategoryStatsEntry(attempts=5, correct=5, wrong=0, consecutive_correct=5)},
        difficulty_stats={"beginner": DifficultyStatsEntry(attempts=5, correct=5, wrong=0)},
        current_difficulty="beginner",
    )
    rec = get_adaptive_recommendation(telemetry)
    assert rec.engine == "deterministic_fallback"
    assert "ml_disabled" in rec.reason


def test_ml_recommendations_when_enabled_explicitly():
    telemetry = JourneyLearningTelemetry(
        recent_outcomes=[OutcomeEntry(is_correct=True) for _ in range(5)],
        category_stats={"phishing": CategoryStatsEntry(attempts=5, correct=5, wrong=0, consecutive_correct=5)},
        difficulty_stats={"beginner": DifficultyStatsEntry(attempts=5, correct=5, wrong=0)},
        current_difficulty="intermediate",
    )
    rec = get_adaptive_recommendation(telemetry, enabled=True)
    assert rec.engine == "ml_softmax_v1"
    assert rec.confidence >= 0.55



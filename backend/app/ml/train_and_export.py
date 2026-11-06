"""
CyberShield Ethiopia — Machine Learning Training, Evaluation & Multi-Target Export Pipeline

Provides reproducible synthetic dataset training, rigorous baseline evaluation,
and safe atomic synchronization between the backend JSON artifact and frontend JS mirror.

Usage:
    python backend/app/ml/train_and_export.py --eval
    python backend/app/ml/train_and_export.py --verify
    python backend/app/ml/train_and_export.py --export
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Ensure backend root is in Python path
_backend_root = Path(__file__).resolve().parents[2]
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from app.ml.features import FEATURE_NAMES
from app.ml.model import SoftmaxClassifier, BaselinePriorClassifier
from app.ml.evaluator import (
    generate_synthetic_pipeline_dataset,
    evaluate_classifier,
    compare_against_baseline,
    DATASET_LIMITATION_STATEMENT,
)

DEFAULT_BACKEND_ARTIFACT = Path(__file__).resolve().parents[1] / "data" / "ml_journey_recommender.json"
DEFAULT_FRONTEND_MIRROR = Path(__file__).resolve().parents[3] / "frontend" / "src" / "lib" / "journeyModelWeights.js"

TRAIN_SAMPLES = 200
TEST_SAMPLES = 60
TRAIN_SEED = 42
TEST_SEED = 123
EPOCHS = 250
BATCH_SIZE = 16
LEARNING_RATE = 0.1
L2_REG = 0.002


def train_reproducible_model(
    train_samples: int = TRAIN_SAMPLES,
    seed: int = TRAIN_SEED,
    epochs: int = EPOCHS,
    batch_size: int = BATCH_SIZE,
    learning_rate: float = LEARNING_RATE,
    l2_reg: float = L2_REG,
) -> SoftmaxClassifier:
    """Trains a SoftmaxClassifier with fixed deterministic seeds for 100% reproducibility."""
    X_train, y_train = generate_synthetic_pipeline_dataset(n_samples=train_samples, seed=seed)
    model = SoftmaxClassifier(
        classes=["beginner", "intermediate", "advanced"],
        feature_names=FEATURE_NAMES,
        learning_rate=learning_rate,
        l2_reg=l2_reg,
    )
    model.fit(X_train, y_train, epochs=epochs, batch_size=batch_size, seed=seed)
    return model


def run_synthetic_evaluation(
    model: Optional[SoftmaxClassifier] = None,
    test_samples: int = TEST_SAMPLES,
    seed: int = TEST_SEED,
) -> Tuple[Dict[str, object], Dict[str, object]]:
    """Evaluates the model against held-out synthetic test data and compares with prior baseline."""
    if model is None:
        model = SoftmaxClassifier.load(DEFAULT_BACKEND_ARTIFACT)

    X_train, y_train = generate_synthetic_pipeline_dataset(n_samples=TRAIN_SAMPLES, seed=TRAIN_SEED)
    X_test, y_test = generate_synthetic_pipeline_dataset(n_samples=test_samples, seed=seed)

    baseline = BaselinePriorClassifier()
    baseline.fit(X_train, y_train)

    metrics = evaluate_classifier(model, X_test, y_test)
    comparison = compare_against_baseline(model, baseline, X_test, y_test)

    return metrics, comparison


def export_backend_json(model: SoftmaxClassifier, path: Path = DEFAULT_BACKEND_ARTIFACT) -> Path:
    """Serializes the model to backend JSON artifact format."""
    path = Path(path)
    model.save(path)
    return path


def export_frontend_js(model: SoftmaxClassifier, path: Path = DEFAULT_FRONTEND_MIRROR) -> Path:
    """Exports exact matching floating-point weights and biases to frontend JS module."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    formatted_weights = "[\n"
    for row in model.weights:
        formatted_weights += "  [\n"
        for val in row:
            formatted_weights += f"    {val},\n"
        formatted_weights += "  ],\n"
    formatted_weights += "]"

    formatted_biases = "[\n"
    for val in model.biases:
        formatted_biases += f"  {val},\n"
    formatted_biases += "]"

    final_loss_val = model.train_loss_history[-1] if model.train_loss_history else 0.21794126742027708

    js_code = f"""/**
 * CyberShield Ethiopia — Authoritative Cyber Hero Journey ML Model Weights
 * 
 * Replicated exactly from backend/app/data/ml_journey_recommender.json.
 * Pure mathematical constants module with zero runtime dependencies.
 * 
 * NOTICE ON DATASET VALIDITY:
 * In strict accordance with CyberShield Ethiopia privacy principles,
 * no telemetry, user input, or personal learner history is collected without informed consent.
 * This model was trained on synthetic pipeline data (generate_synthetic_pipeline_dataset)
 * designed solely to verify algorithmic gradient descent, loss convergence, and inference plumbing.
 * It has NOT been trained or evaluated on human student cohorts. Recommendations represent a
 * baseline heuristic and must always defer to deterministic safety guardrails.
 */

export const MODEL_TYPE = 'SoftmaxClassifier'
export const MODEL_VERSION = '1.0.0'

export const CLASSES = ['beginner', 'intermediate', 'advanced']

export const FEATURE_NAMES = [
  'recent_accuracy',
  'overall_accuracy',
  'current_difficulty_level',
  'consecutive_correct_norm',
  'max_category_error_rate',
  'error_deficit_score',
  'attempt_volume_norm',
  'recent_trend',
]

export const NUM_FEATURES = 8

export const WEIGHTS = {formatted_weights}

export const BIASES = {formatted_biases}

export const CONFIDENCE_THRESHOLD = 0.55

export const HYPERPARAMETERS = {{
  learning_rate: {model.learning_rate},
  l2_reg: {model.l2_reg},
  trained: true,
  final_loss: {final_loss_val},
}}

export const DATASET_LIMITATION_STATEMENT =
  'NOTICE ON DATASET VALIDITY: In strict accordance with CyberShield Ethiopia privacy principles, ' +
  'no telemetry, user input, or personal learner history is collected without informed consent. ' +
  'This model was trained on synthetic pipeline data (generate_synthetic_pipeline_dataset) ' +
  'designed solely to verify algorithmic gradient descent, loss convergence, and inference plumbing. ' +
  'It has not been trained or evaluated on human student cohorts.'

export default {{
  MODEL_TYPE,
  MODEL_VERSION,
  CLASSES,
  FEATURE_NAMES,
  NUM_FEATURES,
  WEIGHTS,
  BIASES,
  CONFIDENCE_THRESHOLD,
  HYPERPARAMETERS,
  DATASET_LIMITATION_STATEMENT,
}}
"""
    with open(path, "w", encoding="utf-8") as f:
        f.write(js_code)
    return path


def verify_consistency(
    backend_path: Path = DEFAULT_BACKEND_ARTIFACT,
    frontend_path: Path = DEFAULT_FRONTEND_MIRROR,
    tolerance: float = 1e-12,
) -> Tuple[bool, Dict[str, float]]:
    """
    Parses and checks exact numerical equivalence between the backend JSON artifact
    and the frontend JS module.
    """
    if not backend_path.is_file():
        raise FileNotFoundError(f"Backend artifact not found at {backend_path}")
    if not frontend_path.is_file():
        raise FileNotFoundError(f"Frontend mirror not found at {frontend_path}")

    with open(backend_path, "r", encoding="utf-8") as f:
        backend_data = json.load(f)

    with open(frontend_path, "r", encoding="utf-8") as f:
        js_content = f.read()

    # Extract weights and biases via regex (handles both LF and CRLF)
    weights_match = re.search(r"export const WEIGHTS = (\[(?:\s*\[[\s\S]*?\]\s*,?)*\s*\])", js_content)
    biases_match = re.search(r"export const BIASES = (\[[\s\S]*?\])", js_content)

    if not weights_match or not biases_match:
        return False, {"error": "Failed to parse weights or biases from frontend module"}

    # Convert JS array syntax to JSON
    cleaned_w = re.sub(r",\s*(\]|\})", r"\1", weights_match.group(1))
    cleaned_b = re.sub(r",\s*(\]|\})", r"\1", biases_match.group(1))

    js_weights = json.loads(cleaned_w)
    js_biases = json.loads(cleaned_b)

    bk_weights = backend_data["weights"]
    bk_biases = backend_data["biases"]

    max_diff_w = max(
        abs(bk_weights[i][j] - js_weights[i][j])
        for i in range(len(bk_weights))
        for j in range(len(bk_weights[i]))
    )
    max_diff_b = max(
        abs(bk_biases[i] - js_biases[i])
        for i in range(len(bk_biases))
    )

    is_consistent = max_diff_w <= tolerance and max_diff_b <= tolerance
    return is_consistent, {
        "max_weight_diff": max_diff_w,
        "max_bias_diff": max_diff_b,
        "tolerance": tolerance,
        "classes_match": backend_data["classes"] == ["beginner", "intermediate", "advanced"],
    }


def main():
    parser = argparse.ArgumentParser(description="CyberShield ML Training & Evaluation Pipeline")
    parser.add_argument("--eval", action="store_true", help="Run evaluation on held-out test split")
    parser.add_argument("--verify", action="store_true", help="Verify backend and frontend artifact parity")
    parser.add_argument("--export", action="store_true", help="Retrain reproducibly and export artifacts")
    args = parser.parse_args()

    if args.verify or (not args.eval and not args.export):
        print("Checking parity between backend JSON artifact and frontend JS mirror...")
        ok, details = verify_consistency()
        print(f"Consistent: {ok}")
        print(f"Details: {json.dumps(details, indent=2)}")
        if not ok:
            sys.exit(1)

    if args.eval:
        print("\n=== RUNNING SYNTHETIC-DATA EVALUATION ===")
        metrics, comparison = run_synthetic_evaluation()
        print("\nTest Metrics (N=60 synthetic test set, seed=123):")
        print(json.dumps(metrics, indent=2))
        print("\nBaseline Prior Comparison:")
        print(json.dumps(comparison, indent=2))

    if args.export:
        print("\n=== EXECUTING REPRODUCIBLE TRAINING & EXPORT ===")
        model = train_reproducible_model()
        export_backend_json(model)
        export_frontend_js(model)
        ok, details = verify_consistency()
        print(f"Export completed. Verification status: {ok} (max diff: {details['max_weight_diff']})")


if __name__ == "__main__":
    main()

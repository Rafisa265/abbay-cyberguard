"""
CyberShield Ethiopia — M1 URL Phishing Lexical ML Training & Export Pipeline

Trains an offline Softmax binary classifier on verified, CC BY 4.0 benchmark URL data
(UCI PhiUSIIL Phishing URL Dataset).
Evaluates precision, recall, macro-F1, log-loss, and confusion matrix against a held-out test split.
Exports dual-target weights: backend JSON and frontend JS module.

Usage:
    python backend/app/ml/train_m1_url_classifier.py --export
"""

import argparse
import json
from pathlib import Path
import random
import sys
from typing import Dict, List, Tuple

# Ensure backend root is on path
_backend_root = Path(__file__).resolve().parents[2]
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from app.ml.m1_url_features import URL_FEATURE_NAMES, extract_url_feature_vector
from app.ml.model import SoftmaxClassifier, BaselinePriorClassifier
from app.ml.evaluator import evaluate_classifier, compare_against_baseline

BENCHMARK_PATH = (
    _backend_root.parent / "data" / "m1_url_pilot" / "splits" / "benchmark_phiusiil.jsonl"
)
BACKEND_ARTIFACT_PATH = (
    _backend_root / "app" / "data" / "ml_m1_url_classifier.json"
)
FRONTEND_MIRROR_PATH = (
    _backend_root.parent / "frontend" / "src" / "lib" / "m1ModelWeights.js"
)

TRAIN_SPLIT_RATIO = 0.8
SEED = 42
EPOCHS = 250
BATCH_SIZE = 32
LEARNING_RATE = 0.1
L2_REG = 0.001


def load_benchmark_records(path: Path = BENCHMARK_PATH) -> List[dict]:
    """Loads audited benchmark URL records with verified ground truth labels."""
    if not path.is_file():
        raise FileNotFoundError(f"Benchmark file not found at: {path}")

    records = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                records.append(json.loads(line))
    return records


def train_and_evaluate_m1_model(
    records: Optional[List[dict]] = None,
    seed: int = SEED,
    epochs: int = EPOCHS,
    batch_size: int = BATCH_SIZE,
    learning_rate: float = LEARNING_RATE,
    l2_reg: float = L2_REG,
) -> Tuple[SoftmaxClassifier, Dict[str, object], Dict[str, object]]:
    """
    Executes reproducible training and evaluation on held-out test data.
    """
    data = records or load_benchmark_records()
    rng = random.Random(seed)
    shuffled = list(data)
    rng.shuffle(shuffled)

    train_size = int(len(shuffled) * TRAIN_SPLIT_RATIO)
    train_records = shuffled[:train_size]
    test_records = shuffled[train_size:]

    X_train = [extract_url_feature_vector(r["normalized_url"]) for r in train_records]
    y_train = [r["label"] for r in train_records]

    X_test = [extract_url_feature_vector(r["normalized_url"]) for r in test_records]
    y_test = [r["label"] for r in test_records]

    # Train model
    classes = ["legitimate", "phishing"]
    model = SoftmaxClassifier(
        classes=classes,
        feature_names=URL_FEATURE_NAMES,
        learning_rate=learning_rate,
        l2_reg=l2_reg,
    )
    model.fit(X_train, y_train, epochs=epochs, batch_size=batch_size, seed=seed)

    # Train majority baseline
    baseline = BaselinePriorClassifier(classes=classes)
    baseline.fit(X_train, y_train)

    # Evaluate
    metrics = evaluate_classifier(model, X_test, y_test)
    comparison = compare_against_baseline(model, baseline, X_test, y_test)

    return model, metrics, comparison


def export_backend_json(model: SoftmaxClassifier, path: Path = BACKEND_ARTIFACT_PATH) -> Path:
    """Exports model weights to backend JSON format."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    model.save(path)
    return path


def export_frontend_js(
    model: SoftmaxClassifier,
    metrics: Dict[str, object],
    path: Path = FRONTEND_MIRROR_PATH,
) -> Path:
    """Exports exact matching floating-point weights and biases to frontend JS module."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    formatted_weights = "[\n"
    for row in model.weights:
        formatted_weights += "  [" + ", ".join(f"{w:.16f}" for w in row) + "],\n"
    formatted_weights += "]"

    formatted_biases = "[" + ", ".join(f"{b:.16f}" for b in model.biases) + "]"

    content = f"""/**
 * CyberShield Ethiopia — M1 URL Lexical Phishing Classifier Weights
 * 
 * Synchronized with backend/app/data/ml_m1_url_classifier.json.
 * Trained on CC BY 4.0 UCI PhiUSIIL Phishing URL Dataset (1,000 verified records).
 * Zero external runtime dependencies. Operates 100% in-browser offline.
 * 
 * Held-Out Test Evaluation:
 * - Accuracy: {metrics.get('accuracy', 0.0):.4f}
 * - Macro F1: {metrics.get('macro_f1', 0.0):.4f}
 * - Log Loss: {metrics.get('mean_log_loss', 0.0):.4f}
 */

export const MODEL_TYPE = '{model.to_dict()["model_type"]}'
export const MODEL_VERSION = '1.0.0'
export const CLASSES = {json.dumps(model.classes)}
export const FEATURE_NAMES = {json.dumps(model.feature_names)}
export const NUM_FEATURES = {model.num_features}
export const WEIGHTS = {formatted_weights}
export const BIASES = {formatted_biases}

export const EVALUATION_METRICS = {json.dumps(metrics, indent=2)}

export const DATASET_PROVENANCE = {{
  dataset: 'UCI PhiUSIIL Phishing URL Dataset',
  citation: 'Prasad, A. & Chandra, S. (2024). PhiUSIIL Phishing URL (Website) [Dataset]. UCI Machine Learning Repository.',
  license: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
  train_samples: 800,
  test_samples: 200,
  seed: {SEED},
  offline_only: true,
}}

export default {{
  MODEL_TYPE,
  MODEL_VERSION,
  CLASSES,
  FEATURE_NAMES,
  NUM_FEATURES,
  WEIGHTS,
  BIASES,
  EVALUATION_METRICS,
  DATASET_PROVENANCE,
}}
"""
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    return path


def main():
    parser = argparse.ArgumentParser(description="Train and export M1 URL Lexical Classifier")
    parser.add_argument("--export", action="store_true", help="Export backend JSON and frontend JS artifacts")
    args = parser.parse_args()

    print("Training M1 URL Lexical Classifier on verified PhiUSIIL dataset...")
    model, metrics, comparison = train_and_evaluate_m1_model()

    print("\n--- Held-Out Test Evaluation Results (200 records) ---")
    print(f"Accuracy:        {metrics['accuracy'] * 100:.2f}% (Baseline: {comparison['baseline_accuracy'] * 100:.2f}%)")
    print(f"Macro F1:        {metrics['macro_f1']:.4f}")
    print(f"Log Loss:        {metrics['mean_log_loss']:.4f}")
    print(f"Lift Over Base:  +{comparison['accuracy_lift'] * 100:.2f}%")
    print(f"Confusion Matrix: {metrics['confusion_matrix']}")
    print(f"Per-Class Metrics: {metrics['per_class']}")

    if args.export:
        b_path = export_backend_json(model)
        f_path = export_frontend_js(model, metrics)
        print(f"\n[OK] Backend artifact saved to: {b_path}")
        print(f"[OK] Frontend mirror saved to:   {f_path}")


if __name__ == "__main__":
    main()


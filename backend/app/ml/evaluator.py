"""
CyberShield Ethiopia - Machine Learning Model Evaluation & Validation Pipeline

Provides rigorous evaluation metrics (Accuracy, Confusion Matrix, Precision, Recall, Macro-F1, Log-Loss).
Explicitly distinguishes synthetic pipeline verification tests from human-validated real-world data.
"""

import math
from typing import Dict, List, Optional, Tuple
from .model import SoftmaxClassifier, BaselinePriorClassifier


DATASET_LIMITATION_STATEMENT = (
    "NOTICE ON DATASET VALIDITY: In strict accordance with CyberShield Ethiopia privacy principles, "
    "no telemetry, user input, or personal learner history is collected without informed consent. "
    "Any dataset generated for pipeline tests is explicitly labelled 'synthetic_pipeline_verification'. "
    "Algorithmic functionality, mathematical gradient convergence, and pipeline integration have been "
    "verified, but production-grade real-world accuracy cannot be asserted until an ethically governed, "
    "consented real-learner evaluation corpus is established."
)


def evaluate_classifier(
    model: SoftmaxClassifier,
    X_test: List[List[float]],
    y_test: List[str],
) -> Dict[str, object]:
    """
    Computes rigorous classification metrics on a held-out evaluation set.
    """
    if not X_test or not y_test:
        raise ValueError("Evaluation data cannot be empty")
    if len(X_test) != len(y_test):
        raise ValueError("X_test and y_test must have equal length")

    n_samples = len(y_test)
    classes = model.classes

    # Confusion matrix: { (actual, predicted): count }
    confusion: Dict[str, Dict[str, int]] = {
        actual: {pred: 0 for pred in classes} for actual in classes
    }

    correct_count = 0
    total_log_loss = 0.0

    for x, actual in zip(X_test, y_test):
        pred_label, _ = model.predict(x)
        probs = model.predict_proba(x)

        if actual in confusion and pred_label in confusion[actual]:
            confusion[actual][pred_label] += 1

        if pred_label == actual:
            correct_count += 1

        prob_actual = max(1e-15, probs.get(actual, 1e-15))
        total_log_loss += -math.log(prob_actual)

    accuracy = correct_count / n_samples
    mean_log_loss = total_log_loss / n_samples

    # Compute per-class Precision, Recall, and F1
    per_class_metrics: Dict[str, Dict[str, float]] = {}
    f1_sum = 0.0

    for c in classes:
        tp = confusion[c][c]
        fp = sum(confusion[other][c] for other in classes if other != c)
        fn = sum(confusion[c][other] for other in classes if other != c)

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (
            2.0 * (precision * recall) / (precision + recall)
            if (precision + recall) > 0
            else 0.0
        )
        f1_sum += f1

        per_class_metrics[c] = {
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1_score": round(f1, 4),
            "support": sum(confusion[c].values()),
        }

    macro_f1 = f1_sum / len(classes)

    return {
        "num_samples": n_samples,
        "accuracy": round(accuracy, 4),
        "macro_f1": round(macro_f1, 4),
        "mean_log_loss": round(mean_log_loss, 4),
        "per_class": per_class_metrics,
        "confusion_matrix": confusion,
    }


def compare_against_baseline(
    ml_model: SoftmaxClassifier,
    baseline_model: BaselinePriorClassifier,
    X_test: List[List[float]],
    y_test: List[str],
) -> Dict[str, object]:
    """
    Compares the trained ML model against a simple prior baseline on held-out data.
    """
    ml_metrics = evaluate_classifier(ml_model, X_test, y_test)

    baseline_correct = sum(
        1 for x, y in zip(X_test, y_test) if baseline_model.predict(x)[0] == y
    )
    baseline_acc = baseline_correct / len(y_test)

    acc_lift = ml_metrics["accuracy"] - baseline_acc

    return {
        "ml_accuracy": ml_metrics["accuracy"],
        "baseline_accuracy": round(baseline_acc, 4),
        "accuracy_lift": round(acc_lift, 4),
        "ml_macro_f1": ml_metrics["macro_f1"],
        "ml_log_loss": ml_metrics["mean_log_loss"],
        "is_superior_to_baseline": ml_metrics["accuracy"] > baseline_acc,
    }


def generate_synthetic_pipeline_dataset(
    n_samples: int = 180,
    seed: int = 42,
) -> Tuple[List[List[float]], List[str]]:
    """
    Generates a deterministic synthetic dataset for pipeline verification and testing only.
    Clearly marked as synthetic; not a substitute for human learner data.
    """
    import random
    rng = random.Random(seed)

    X: List[List[float]] = []
    y: List[str] = []

    for _ in range(n_samples):
        cluster = rng.choice(["beginner", "intermediate", "advanced"])

        if cluster == "beginner":
            # Low recent accuracy, high error deficit, beginner level
            recent_acc = rng.uniform(0.0, 0.45)
            overall_acc = rng.uniform(0.1, 0.5)
            curr_diff = 0.0
            consec = rng.uniform(0.0, 0.2)
            max_cat_err = rng.uniform(0.5, 1.0)
            deficit = rng.uniform(0.4, 1.0)
            volume = rng.uniform(0.05, 0.6)
            trend = rng.uniform(0.2, 0.55)
            label = "beginner"
        elif cluster == "intermediate":
            # Moderate accuracy, low deficit, intermediate difficulty
            recent_acc = rng.uniform(0.55, 0.8)
            overall_acc = rng.uniform(0.55, 0.8)
            curr_diff = rng.choice([0.0, 0.5])
            consec = rng.uniform(0.4, 0.7)
            max_cat_err = rng.uniform(0.1, 0.4)
            deficit = rng.uniform(0.0, 0.3)
            volume = rng.uniform(0.25, 0.8)
            trend = rng.uniform(0.45, 0.75)
            label = "intermediate"
        else:
            # High accuracy, high volume, advancing to advanced
            recent_acc = rng.uniform(0.8, 1.0)
            overall_acc = rng.uniform(0.75, 1.0)
            curr_diff = rng.choice([0.5, 1.0])
            consec = rng.uniform(0.6, 1.0)
            max_cat_err = rng.uniform(0.0, 0.25)
            deficit = rng.uniform(0.0, 0.2)
            volume = rng.uniform(0.4, 1.0)
            trend = rng.uniform(0.5, 0.85)
            label = "advanced"

        vector = [
            recent_acc,
            overall_acc,
            curr_diff,
            consec,
            max_cat_err,
            deficit,
            volume,
            trend,
        ]
        X.append(vector)
        y.append(label)

    return X, y

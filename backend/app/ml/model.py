"""
CyberShield Ethiopia - Machine Learning Classifier Models

Contains a mathematically rigorous, self-contained Softmax Logistic Regression Classifier
and a Dummy / Prior Baseline Classifier implemented with pure Python standard library math.
Zero external runtime dependencies required.
"""

import json
import math
import random
from pathlib import Path
from typing import Dict, List, Optional, Tuple


class BaselinePriorClassifier:
    """
    Majority-Class Prior Baseline Classifier.
    Used for empirical comparison to verify whether the ML model provides genuine predictive lift.
    """
    def __init__(self, classes: Optional[List[str]] = None):
        self.classes: List[str] = classes or ["beginner", "intermediate", "advanced"]
        self.class_counts: Dict[str, int] = {c: 0 for c in self.classes}
        self.priors: Dict[str, float] = {c: 1.0 / len(self.classes) for c in self.classes}
        self.majority_class: str = self.classes[0]
        self.trained: bool = False

    def fit(self, X: List[List[float]], y: List[str]) -> "BaselinePriorClassifier":
        if not y:
            raise ValueError("Training dataset y cannot be empty")
        self.class_counts = {c: 0 for c in self.classes}
        for label in y:
            if label in self.class_counts:
                self.class_counts[label] += 1
            else:
                self.class_counts[label] = 1

        total = len(y)
        self.priors = {c: count / total for c, count in self.class_counts.items()}
        self.majority_class = max(self.priors.items(), key=lambda item: item[1])[0]
        self.trained = True
        return self

    def predict_proba(self, x: List[float]) -> Dict[str, float]:
        return dict(self.priors)

    def predict(self, x: List[float]) -> Tuple[str, float]:
        return self.majority_class, self.priors[self.majority_class]


class SoftmaxClassifier:
    """
    Multinomial Softmax Logistic Regression Classifier with L2 Regularization.
    Trained via Gradient Descent with Cross-Entropy Loss.
    """
    def __init__(
        self,
        classes: Optional[List[str]] = None,
        feature_names: Optional[List[str]] = None,
        learning_rate: float = 0.08,
        l2_reg: float = 0.005,
    ):
        self.classes: List[str] = classes or ["beginner", "intermediate", "advanced"]
        self.feature_names: List[str] = feature_names or [f"f_{i}" for i in range(8)]
        self.num_classes: int = len(self.classes)
        self.num_features: int = len(self.feature_names)
        self.learning_rate: float = learning_rate
        self.l2_reg: float = l2_reg

        # Weights: matrix of shape [num_classes][num_features]
        # Initialized with small deterministic values or zeros
        self.weights: List[List[float]] = [
            [0.0 for _ in range(self.num_features)] for _ in range(self.num_classes)
        ]
        # Biases: vector of shape [num_classes]
        self.biases: List[float] = [0.0 for _ in range(self.num_classes)]

        self.trained: bool = False
        self.train_loss_history: List[float] = []

    def _softmax(self, logits: List[float]) -> List[float]:
        """Numerically stable softmax computation."""
        max_logit = max(logits)
        exp_vals = [math.exp(z - max_logit) for z in logits]
        sum_exp = sum(exp_vals)
        if sum_exp == 0.0:
            return [1.0 / len(logits)] * len(logits)
        return [e / sum_exp for e in exp_vals]

    def _forward(self, x: List[float]) -> Tuple[List[float], List[float]]:
        """Calculates raw logits and softmax probabilities."""
        logits = []
        for k in range(self.num_classes):
            dot = sum(self.weights[k][d] * x[d] for d in range(self.num_features))
            logits.append(dot + self.biases[k])
        probs = self._softmax(logits)
        return logits, probs

    def fit(
        self,
        X: List[List[float]],
        y: List[str],
        epochs: int = 200,
        batch_size: int = 16,
        seed: int = 42,
    ) -> "SoftmaxClassifier":
        """
        Trains model parameters using mini-batch gradient descent.
        """
        if not X or not y:
            raise ValueError("X and y cannot be empty")
        if len(X) != len(y):
            raise ValueError("X and y must have identical length")

        self.num_features = len(X[0])
        self.weights = [
            [0.0 for _ in range(self.num_features)] for _ in range(self.num_classes)
        ]
        self.biases = [0.0 for _ in range(self.num_classes)]

        class_to_idx = {c: i for i, c in enumerate(self.classes)}
        y_indices = [class_to_idx[label] for label in y]

        n_samples = len(X)
        self.train_loss_history = []
        rng = random.Random(seed)

        indices = list(range(n_samples))

        for epoch in range(epochs):
            rng.shuffle(indices)
            epoch_loss = 0.0

            for start_idx in range(0, n_samples, batch_size):
                batch_indices = indices[start_idx : start_idx + batch_size]
                actual_batch_size = len(batch_indices)

                # Accumulate gradients
                grad_w = [
                    [0.0 for _ in range(self.num_features)]
                    for _ in range(self.num_classes)
                ]
                grad_b = [0.0 for _ in range(self.num_classes)]

                for i in batch_indices:
                    xi = X[i]
                    target_k = y_indices[i]
                    _, probs = self._forward(xi)

                    # Cross-entropy loss: -log(P(target))
                    prob_target = max(1e-15, probs[target_k])
                    epoch_loss += -math.log(prob_target)

                    # Softmax gradient: P_k - 1(y == k)
                    for k in range(self.num_classes):
                        error = probs[k] - (1.0 if k == target_k else 0.0)
                        grad_b[k] += error
                        for d in range(self.num_features):
                            grad_w[k][d] += error * xi[d]

                # Apply gradient step with L2 regularization
                scale = 1.0 / actual_batch_size
                for k in range(self.num_classes):
                    self.biases[k] -= self.learning_rate * (grad_b[k] * scale)
                    for d in range(self.num_features):
                        reg_term = self.l2_reg * self.weights[k][d]
                        self.weights[k][d] -= self.learning_rate * (
                            (grad_w[k][d] * scale) + reg_term
                        )

            # L2 penalty to total epoch loss
            l2_loss = 0.5 * self.l2_reg * sum(
                self.weights[k][d] ** 2
                for k in range(self.num_classes)
                for d in range(self.num_features)
            )
            mean_loss = (epoch_loss / n_samples) + l2_loss
            self.train_loss_history.append(mean_loss)

        self.trained = True
        return self

    def predict_proba(self, x: List[float]) -> Dict[str, float]:
        """Returns normalized probability distribution across classes."""
        if len(x) != self.num_features:
            raise ValueError(
                f"Feature dimension mismatch: expected {self.num_features}, got {len(x)}"
            )
        _, probs = self._forward(x)
        return {self.classes[i]: probs[i] for i in range(self.num_classes)}

    def predict(self, x: List[float]) -> Tuple[str, float]:
        """
        Returns (predicted_class_name, confidence_probability).
        """
        probs = self.predict_proba(x)
        best_class, best_prob = max(probs.items(), key=lambda item: item[1])
        return best_class, best_prob

    def to_dict(self) -> dict:
        """Serializes model weights and parameters to a dictionary."""
        return {
            "model_type": "SoftmaxClassifier",
            "version": "1.0.0",
            "classes": self.classes,
            "feature_names": self.feature_names,
            "num_features": self.num_features,
            "weights": self.weights,
            "biases": self.biases,
            "learning_rate": self.learning_rate,
            "l2_reg": self.l2_reg,
            "trained": self.trained,
            "final_loss": self.train_loss_history[-1] if self.train_loss_history else None,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "SoftmaxClassifier":
        """Instantiates a model from a serialized dictionary."""
        model = cls(
            classes=data["classes"],
            feature_names=data.get("feature_names"),
            learning_rate=data.get("learning_rate", 0.08),
            l2_reg=data.get("l2_reg", 0.005),
        )
        model.weights = data["weights"]
        model.biases = data["biases"]
        model.num_features = len(model.weights[0])
        model.trained = data.get("trained", True)
        return model

    def save(self, filepath: Path) -> None:
        filepath = Path(filepath)
        filepath.parent.mkdir(parents=True, exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=2)

    @classmethod
    def load(cls, filepath: Path) -> "SoftmaxClassifier":
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        return cls.from_dict(data)

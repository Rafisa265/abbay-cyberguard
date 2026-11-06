"""
CyberShield Ethiopia - Adaptive Machine Learning Package

Provides offline-first, privacy-preserving machine learning capabilities
specifically for personalized Journey learning recommendations.
"""

from .features import JourneyLearningTelemetry, extract_feature_vector, FEATURE_NAMES
from .model import SoftmaxClassifier, BaselinePriorClassifier
from .service import get_adaptive_recommendation, get_ml_status

__all__ = [
    "JourneyLearningTelemetry",
    "extract_feature_vector",
    "FEATURE_NAMES",
    "SoftmaxClassifier",
    "BaselinePriorClassifier",
    "get_adaptive_recommendation",
    "get_ml_status",
]

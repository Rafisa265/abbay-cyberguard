/**
 * CyberShield Ethiopia — M1 URL Lexical Phishing Classifier Weights
 * 
 * Synchronized with backend/app/data/ml_m1_url_classifier.json.
 * Trained on CC BY 4.0 UCI PhiUSIIL Phishing URL Dataset (1,000 verified records).
 * Zero external runtime dependencies. Operates 100% in-browser offline.
 * 
 * Held-Out Test Evaluation:
 * - Accuracy: 0.9250
 * - Macro F1: 0.9250
 * - Log Loss: 0.2142
 */

export const MODEL_TYPE = 'SoftmaxClassifier'
export const MODEL_VERSION = '1.0.0'
export const CLASSES = ["legitimate", "phishing"]
export const FEATURE_NAMES = ["url_length_norm", "domain_length_norm", "path_length_norm", "subdomain_count_norm", "dot_count_norm", "hyphen_count_norm", "digit_ratio_scaled", "has_ip_host", "has_at_symbol", "is_https", "has_suspicious_keyword", "domain_entropy_norm"]
export const NUM_FEATURES = 12
export const WEIGHTS = [
  [-1.6548491210853513, -1.4160981350755402, -1.7127307634441629, 1.1720660341693359, 0.6372350829926594, -1.7694529400243921, -3.0726847641361679, -0.0106127101081499, -0.3543882929438403, 2.9564863032332807, -0.5914017262712457, -1.1574777970796584],
  [1.6548491210853520, 1.4160981350755406, 1.7127307634441629, -1.1720660341693356, -0.6372350829926606, 1.7694529400243924, 3.0726847641361683, 0.0106127101081499, 0.3543882929438404, -2.9564863032332838, 0.5914017262712460, 1.1574777970796586],
]
export const BIASES = [-0.8163286761694450, 0.8163286761694446]

export const EVALUATION_METRICS = {
  "num_samples": 200,
  "accuracy": 0.925,
  "macro_f1": 0.925,
  "mean_log_loss": 0.2142,
  "per_class": {
    "legitimate": {
      "precision": 0.8762,
      "recall": 0.9787,
      "f1_score": 0.9246,
      "support": 94
    },
    "phishing": {
      "precision": 0.9789,
      "recall": 0.8774,
      "f1_score": 0.9254,
      "support": 106
    }
  },
  "confusion_matrix": {
    "legitimate": {
      "legitimate": 92,
      "phishing": 2
    },
    "phishing": {
      "legitimate": 13,
      "phishing": 93
    }
  }
}

export const DATASET_PROVENANCE = {
  dataset: 'UCI PhiUSIIL Phishing URL Dataset',
  citation: 'Prasad, A. & Chandra, S. (2024). PhiUSIIL Phishing URL (Website) [Dataset]. UCI Machine Learning Repository.',
  license: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
  train_samples: 800,
  test_samples: 200,
  seed: 42,
  offline_only: true,
}

export default {
  MODEL_TYPE,
  MODEL_VERSION,
  CLASSES,
  FEATURE_NAMES,
  NUM_FEATURES,
  WEIGHTS,
  BIASES,
  EVALUATION_METRICS,
  DATASET_PROVENANCE,
}

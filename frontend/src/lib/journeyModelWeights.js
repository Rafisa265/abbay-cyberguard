/**
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

export const WEIGHTS = [
  [
    -1.913261853460283,
    -1.6291726335409447,
    -1.1037195511441242,
    -2.0438127287846837,
    2.9076401224880466,
    2.9869087086394916,
    -0.7429544829654651,
    -0.4900967374017158,
  ],
  [
    -0.2713044522283068,
    -0.20583566078390864,
    -1.6149500557020748,
    -0.10485089913694827,
    -0.048038595606019474,
    -1.7367598495136256,
    -0.012757277226266406,
    0.7810439107918684,
  ],
  [
    2.1845663056885893,
    1.8350082943248558,
    2.7186696068461864,
    2.1486636279216347,
    -2.8596015268820243,
    -1.2501488591258636,
    0.7557117601917295,
    -0.2909471733901535,
  ],
]

export const BIASES = [
  1.7061971278864008,
  2.376791729815361,
  -4.082988857701772,
]

export const CONFIDENCE_THRESHOLD = 0.55

export const HYPERPARAMETERS = {
  learning_rate: 0.1,
  l2_reg: 0.002,
  trained: true,
  final_loss: 0.21794126742027708,
}

export const DATASET_LIMITATION_STATEMENT =
  'NOTICE ON DATASET VALIDITY: In strict accordance with CyberShield Ethiopia privacy principles, ' +
  'no telemetry, user input, or personal learner history is collected without informed consent. ' +
  'This model was trained on synthetic pipeline data (generate_synthetic_pipeline_dataset) ' +
  'designed solely to verify algorithmic gradient descent, loss convergence, and inference plumbing. ' +
  'It has not been trained or evaluated on human student cohorts.'

export default {
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
}

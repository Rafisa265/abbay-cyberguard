/**
 * CyberShield Ethiopia — M3 Incident Report Text Classifier Weights
 * 
 * Synchronized with backend/app/data/ml_m3_incident_classifier.json.
 * Trained on trilingual curated corpus across English, Afaan Oromoo, and Amharic.
 * Zero network dependencies. Operates 100% in-browser offline for privacy preservation.
 * 
 * Held-Out Test Evaluation (24 records):
 * - Accuracy: 0.9583
 * - Macro F1: 0.9596
 * - Log Loss: 0.2247
 */

export const MODEL_TYPE = 'SoftmaxClassifier'
export const MODEL_VERSION = '1.0.0'
export const CLASSES = ["fraud", "phishing", "takeover", "malware", "sim_otp"]
export const FEATURE_NAMES = ["otp_secret", "sim_deactivation", "telecom_brand", "mobile_money_brand", "mistaken_transfer", "lottery_prize", "advance_fee", "bank_financial", "password_credentials", "link_fake_site", "portal_scholarship", "apk_download", "accessibility_perm", "malware_trojan", "account_takeover", "telegram_messaging", "threat_urgency", "monetary_loss"]
export const NUM_FEATURES = 18
export const WEIGHTS = [
  [-0.3398019652866046, -0.5294512067817195, -0.4236781454229090, 2.7851077217773867, 1.7656065336814002, 1.9134699528646901, 1.4924500574985942, 0.6493566345575061, -1.0732030658475689, -0.9381240522406035, 0.0820045549235445, -0.9903672699926386, -0.3953190092793221, -0.2477222622294138, -0.3932168997227363, -0.6109320629784409, 0.2226579614072276, 0.2505159920283473],
  [-0.8050495294383009, -0.4970607680460890, 0.0169816448766277, -0.6883564403983126, -0.4423474668329896, -0.3692309584277989, -0.3201367217646307, 0.8177601743247440, 0.4364409685182435, 4.0023366955135611, 1.1059301486147102, -0.8799258003394514, -0.4152728216894963, -0.2710523625382725, -0.3702627576216452, 0.4283203171386902, 0.7268114343929266, -0.2283107497648833],
  [-1.4906296331467521, -1.0133263720225025, -0.6840230478087646, -1.0212171784061872, -0.5995590597962730, -0.8309732277367708, -0.6046512294267532, -0.9924078481822414, 1.2583685517233996, -1.8012467831813708, -0.5467955467334141, -1.5053417124682800, -0.2092382139750782, -0.5370398189711336, 1.4078787986271339, 0.6884198654909409, -0.5784266246944201, 0.2367941866979306],
  [-0.3335457837238228, -0.3940460858748656, -0.3060163202442269, -0.2298185442852922, -0.3238759988181047, -0.3241014342851427, -0.2613221816684924, -0.0562007515153895, -0.6668316590241298, -0.3790680840590501, -0.4127705275825500, 4.2350219267815090, 1.4388278463992483, 1.3973983372449081, -0.2834897463339485, 0.0614128921403952, -0.4066454259555982, 0.0469956779499885],
  [2.9690269115954786, 2.4338844327251721, 1.3967358685992766, -0.8457155586875931, -0.3998240082340332, -0.3891643324149764, -0.3063399246387191, -0.4185082091846207, 0.0452252046300549, -0.8838977760325323, -0.2283686292222917, -0.8593871439811456, -0.4189978014553550, -0.3415838935060881, -0.3609093949488089, -0.5672210117915861, 0.0356026548498623, -0.3059951069113835],
]
export const BIASES = [-0.0172633180878686, -0.3745572122955616, 1.3040052299189728, -0.7432931998944992, -0.1688914996410467]

export const CONFIDENCE_THRESHOLD = 0.50

export const EVALUATION_METRICS = {
  "num_samples": 24,
  "accuracy": 0.9583,
  "macro_f1": 0.9596,
  "mean_log_loss": 0.2247,
  "per_class": {
    "fraud": {
      "precision": 1.0,
      "recall": 1.0,
      "f1_score": 1.0,
      "support": 3
    },
    "phishing": {
      "precision": 1.0,
      "recall": 1.0,
      "f1_score": 1.0,
      "support": 6
    },
    "takeover": {
      "precision": 0.8333,
      "recall": 1.0,
      "f1_score": 0.9091,
      "support": 5
    },
    "malware": {
      "precision": 1.0,
      "recall": 1.0,
      "f1_score": 1.0,
      "support": 5
    },
    "sim_otp": {
      "precision": 1.0,
      "recall": 0.8,
      "f1_score": 0.8889,
      "support": 5
    }
  },
  "confusion_matrix": {
    "fraud": {
      "fraud": 3,
      "phishing": 0,
      "takeover": 0,
      "malware": 0,
      "sim_otp": 0
    },
    "phishing": {
      "fraud": 0,
      "phishing": 6,
      "takeover": 0,
      "malware": 0,
      "sim_otp": 0
    },
    "takeover": {
      "fraud": 0,
      "phishing": 0,
      "takeover": 5,
      "malware": 0,
      "sim_otp": 0
    },
    "malware": {
      "fraud": 0,
      "phishing": 0,
      "takeover": 0,
      "malware": 5,
      "sim_otp": 0
    },
    "sim_otp": {
      "fraud": 0,
      "phishing": 0,
      "takeover": 1,
      "malware": 0,
      "sim_otp": 4
    }
  }
}

export const INCIDENT_KEYWORD_GROUPS = {
  otp_secret: ['otp', 'one-time', 'verification code', 'secret code', 'koodii', 'iccitii', 'koodii mirkaneessaa', 'ኦቲፒ', 'ሚስጥር ቁጥር', 'የማረጋገጫ ኮድ', 'ኮድ'],
  sim_deactivation: ['sim', 'sim card', 'deactivation', 'deactivate', 'disconnect', 'cellular', 'tower', 'kaardii', 'cufama', 'tajaajila ala', 'ሲም', 'ሲም ካርድ', 'መዘጋት', 'ይዘጋል'],
  telecom_brand: ['telecom', 'ethio telecom', '994', 'carrier', 'telekoomii', 'itoophiyaa telekoom', 'ቴሌኮም', 'ኢትዮ ቴሌኮም'],
  mobile_money_brand: ['telebirr', '127', 'cbe birr', 'cbebirr', 'birr', 'etb', 'qarshii', 'ቴሌብር', 'ሲቢኢ ብር', 'ብር'],
  mistaken_transfer: ['transfer', 'transferred', 'mistaken', 'accidental', 'refund', 'reverse', 'sent to you', 'dabarsa', 'dogoggoraan', 'deebisi', 'ergameera', 'ዝውውር', 'በስህተት', 'መልስ', 'ተልኮልዎታል'],
  lottery_prize: ['lottery', 'won', 'prize', 'winner', 'reward', 'congratulations', 'mooteetta', 'badhaasa', 'badhaafamte', 'ሎተሪ', 'ሽልማት', 'አሸነፉ', 'እንኳን ደስ አለዎት'],
  advance_fee: ['fee', 'processing fee', 'upfront', 'registration fee', 'send fee', 'kaffaltii', 'dursanii', 'ክፍያ', 'ቅድመ ክፍያ', 'የምዝገባ ክፍያ'],
  bank_financial: ['bank', 'cbe', 'commercial bank', 'account number', 'banking app', 'atm', 'baankii', 'herrega', 'baankii daldalaa', 'ባንክ', 'ንግድ ባንክ', 'የባንክ ሂሳብ'],
  password_credentials: ['password', 'passcode', 'pin', 'credentials', 'login details', 'passphrase', 'jecha darbii', 'lakkoofsa iccitii', 'የይለፍ ቃል', 'የይለፍ', 'ፒን', 'ሚስጥር'],
  link_fake_site: ['link', 'url', 'website', 'click', 'tapped', 'form', 'linkii', 'marsariitii', 'tuqe', 'ሊንክ', 'ድረ-ገጽ', 'ይጫኑ', 'ነካሁ'],
  portal_scholarship: ['portal', 'university', 'student', 'scholarship', 'admission', 'grade', 'barataa', 'yuunivarsiitii', 'ፖርታል', 'ዩኒቨርሲቲ', 'ተማሪ', 'ስኮላርሺፕ'],
  apk_download: ['apk', 'app', 'download', 'downloaded', 'install', 'installed', 'sideload', 'buusee', "fe'uu", 'appilikeeshinii', 'ኤፒኬ', 'መተግበሪያ', 'አወረድኩ', 'ጫንኩ'],
  accessibility_perm: ['accessibility', 'permission', 'administrator', 'device admin', 'granted', 'heyyama', 'ፈቃድ', 'የአንድሮይድ ፈቃድ', 'ቁጥጥር'],
  malware_trojan: ['trojan', 'malware', 'virus', 'booster', 'unauthorized app', 'summii', 'ቫይረስ', 'ተንኮል አዘል', 'ማልዌር'],
  account_takeover: ['hijack', 'hijacked', 'hacked', 'locked out', 'logged out', 'stolen account', 'changed password', 'jijjiirame', 'hatame', 'saamame', 'cufameera', 'ተጠለፈ', 'ተሰረቀ', 'ተዘጋብኝ', 'የይለፍ ቃሌ ተቀየረ'],
  telegram_messaging: ['telegram', 'bot', 'channel', 'group', 'whatsapp', 'telegiraamii', 'bootii', 'ቴሌግራም', 'ቦት', 'ቻናል'],
  threat_urgency: ['urgent', 'suspended', 'suspend', 'hours', 'immediate', 'immediately', 'deadline', 'sardama', 'ariifachiisaa', 'dafii', 'አስቸኳይ', 'አሁኑኑ', 'እገዳ', 'ይታገዳል', 'ሰዓት'],
  monetary_loss: ['lost money', 'stole', 'drained', 'unauthorized debit', 'deducted', 'dhabe', 'saamame', 'baafame', 'ተዘረፍኩ', 'ተወሰደብኝ', 'ገንዘብ ወጣብኝ', 'ተቆረጠ'],
}

export default {
  MODEL_TYPE,
  MODEL_VERSION,
  CLASSES,
  FEATURE_NAMES,
  NUM_FEATURES,
  WEIGHTS,
  BIASES,
  CONFIDENCE_THRESHOLD,
  EVALUATION_METRICS,
  INCIDENT_KEYWORD_GROUPS,
}

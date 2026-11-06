"""
CyberShield Ethiopia — M3 Incident Report Text Feature Extraction Subsystem

Extracts privacy-preserving, localized bag-of-indicators feature vectors from cybercrime incident
descriptions across English, Afaan Oromoo, and Amharic.
Operates 100% offline in browser memory; zero user text is ever transmitted externally.
"""

import re
from typing import Dict, List, Tuple

INCIDENT_CLASSES = ["fraud", "phishing", "takeover", "malware", "sim_otp"]

# Trilingual keyword groups mapped to feature indices
INCIDENT_KEYWORD_GROUPS: Dict[str, List[str]] = {
    "otp_secret": [
        "otp", "one-time", "verification code", "secret code",
        "koodii", "iccitii", "koodii mirkaneessaa",
        "ኦቲፒ", "ሚስጥር ቁጥር", "የማረጋገጫ ኮድ", "ኮድ",
    ],
    "sim_deactivation": [
        "sim", "sim card", "deactivation", "deactivate", "disconnect", "cellular", "tower",
        "kaardii", "cufama", "tajaajila ala",
        "ሲም", "ሲም ካርድ", "መዘጋት", "ይዘጋል",
    ],
    "telecom_brand": [
        "telecom", "ethio telecom", "994", "carrier",
        "telekoomii", "itoophiyaa telekoom",
        "ቴሌኮም", "ኢትዮ ቴሌኮም",
    ],
    "mobile_money_brand": [
        "telebirr", "127", "cbe birr", "cbebirr", "birr", "etb",
        "qarshii",
        "ቴሌብር", "ሲቢኢ ብር", "ብር",
    ],
    "mistaken_transfer": [
        "transfer", "transferred", "mistaken", "accidental", "refund", "reverse", "sent to you",
        "dabarsa", "dogoggoraan", "deebisi", "ergameera",
        "ዝውውር", "በስህተት", "መልስ", "ተልኮልዎታል",
    ],
    "lottery_prize": [
        "lottery", "won", "prize", "winner", "reward", "congratulations",
        "mooteetta", "badhaasa", "badhaafamte",
        "ሎተሪ", "ሽልማት", "አሸነፉ", "እንኳን ደስ አለዎት",
    ],
    "advance_fee": [
        "fee", "processing fee", "upfront", "registration fee", "send fee",
        "kaffaltii", "dursanii",
        "ክፍያ", "ቅድመ ክፍያ", "የምዝገባ ክፍያ",
    ],
    "bank_financial": [
        "bank", "cbe", "commercial bank", "account number", "banking app", "atm",
        "baankii", "herrega", "baankii daldalaa",
        "ባንክ", "ንግድ ባንክ", "የባንክ ሂሳብ",
    ],
    "password_credentials": [
        "password", "passcode", "pin", "credentials", "login details", "passphrase",
        "jecha darbii", "lakkoofsa iccitii",
        "የይለፍ ቃል", "የይለፍ", "ፒን", "ሚስጥር",
    ],
    "link_fake_site": [
        "link", "url", "website", "click", "tapped", "form",
        "linkii", "marsariitii", "tuqe",
        "ሊንክ", "ድረ-ገጽ", "ይጫኑ", "ነካሁ",
    ],
    "portal_scholarship": [
        "portal", "university", "student", "scholarship", "admission", "grade",
        "barataa", "yuunivarsiitii",
        "ፖርታል", "ዩኒቨርሲቲ", "ተማሪ", "ስኮላርሺፕ",
    ],
    "apk_download": [
        "apk", "app", "download", "downloaded", "install", "installed", "sideload",
        "buusee", "fe'uu", "appilikeeshinii",
        "ኤፒኬ", "መተግበሪያ", "አወረድኩ", "ጫንኩ",
    ],
    "accessibility_perm": [
        "accessibility", "permission", "administrator", "device admin", "granted",
        "heyyama",
        "ፈቃድ", "የአንድሮይድ ፈቃድ", "ቁጥጥር",
    ],
    "malware_trojan": [
        "trojan", "malware", "virus", "booster", "unauthorized app",
        "summii",
        "ቫይረስ", "ተንኮል አዘል", "ማልዌር",
    ],
    "account_takeover": [
        "hijack", "hijacked", "hacked", "locked out", "logged out", "stolen account", "changed password",
        "jijjiirame", "hatame", "saamame", "cufameera",
        "ተጠለፈ", "ተሰረቀ", "ተዘጋብኝ", "የይለፍ ቃሌ ተቀየረ",
    ],
    "telegram_messaging": [
        "telegram", "bot", "channel", "group", "whatsapp",
        "telegiraamii", "bootii",
        "ቴሌግራም", "ቦት", "ቻናል",
    ],
    "threat_urgency": [
        "urgent", "suspended", "suspend", "hours", "immediate", "immediately", "deadline",
        "sardama", "ariifachiisaa", "dafii",
        "አስቸኳይ", "አሁኑኑ", "እገዳ", "ይታገዳል", "ሰዓት",
    ],
    "monetary_loss": [
        "lost money", "stole", "drained", "unauthorized debit", "deducted",
        "dhabe", "saamame", "baafame",
        "ተዘረፍኩ", "ተወሰደብኝ", "ገንዘብ ወጣብኝ", "ተቆረጠ",
    ],
}

FEATURE_GROUP_NAMES = list(INCIDENT_KEYWORD_GROUPS.keys())
NUM_INCIDENT_FEATURES = len(FEATURE_GROUP_NAMES)


def extract_incident_features(text: str) -> Tuple[List[float], List[str]]:
    """
    Extracts normalized indicator feature vector and identified keyword tokens.
    Returns: (features: List[float], detected_indicators: List[str])
    """
    if not text or not isinstance(text, str):
        return [0.0] * NUM_INCIDENT_FEATURES, []

    lower = text.lower()
    # Normalize punctuation and Ethiopic word dividers to spaces
    clean = re.sub(r"[\u1361-\u1368\s,.:;!?'\"()\[\]{}/\\_-]+", " ", lower).strip()

    vector: List[float] = []
    detected: List[str] = []

    for group_name in FEATURE_GROUP_NAMES:
        keywords = INCIDENT_KEYWORD_GROUPS[group_name]
        matches = 0
        matched_words = []

        for kw in keywords:
            if kw in clean:
                matches += 1
                matched_words.append(kw)

        if matches > 0:
            # Scaled presence: saturated at 3 matches
            val = round(min(1.0, 0.4 + (matches * 0.2)), 4)
            vector.append(val)
            detected.append(f"{group_name}:{matched_words[0]}")
        else:
            vector.append(0.0)

    return vector, detected


"""
CyberShield Ethiopia — M3 Incident Report Text Classifier Training & Export Pipeline

Trains a multinomial Softmax classifier on verified trilingual cybersecurity incident descriptions
spanning English, Afaan Oromoo, and Amharic across 5 core categories:
  1. fraud
  2. phishing
  3. takeover
  4. malware
  5. sim_otp

Evaluates held-out precision, recall, macro-F1, log-loss, and confusion matrix against a majority baseline.
Exports dual-target weights: backend JSON artifact and frontend JS mirror.

Usage:
    python backend/app/ml/train_m3_incident_classifier.py --export
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

from app.ml.m3_incident_features import (
    INCIDENT_CLASSES,
    FEATURE_GROUP_NAMES,
    extract_incident_features,
)
from app.ml.model import SoftmaxClassifier, BaselinePriorClassifier
from app.ml.evaluator import evaluate_classifier, compare_against_baseline

BACKEND_ARTIFACT_PATH = (
    _backend_root / "app" / "data" / "ml_m3_incident_classifier.json"
)
FRONTEND_MIRROR_PATH = (
    _backend_root.parent / "frontend" / "src" / "lib" / "incidentModelWeights.js"
)

# Curated trilingual training dataset: 120 verified scenario descriptions (24 per class across EN, OM, AM)
CURATED_INCIDENT_CORPUS: List[Tuple[str, str]] = [
    # --- Category: phishing (24 samples) ---
    ("Received an email pretending to be Addis Ababa University asking me to click a link to update portal password.", "phishing"),
    ("SMS claiming from Commercial Bank of Ethiopia with link cbe-verify.invalid asking to enter my credentials.", "phishing"),
    ("A WhatsApp message sent me a deceptive web form asking for my email login and student ID.", "phishing"),
    ("A spoofed message from Ethio Telecom containing a link to claim mobile airtime by entering my password.", "phishing"),
    ("A fake lottery notification containing a link to a lookalike portal asking for my banking PIN.", "phishing"),
    ("Phishing email claiming my account was suspended and directed me to a fake login site.", "phishing"),
    ("I entered my password on a fraudulent web form that looked identical to my university login page.", "phishing"),
    ("Unsolicited message on Telegram with an external link asking to verify my online banking details.", "phishing"),
    ("Ergaa sobaa baankii daldalaa irraa linkii fakkaatu erguun jecha icciitii koo akka galchu na gaafatan.", "phishing"),
    ("Linkii marsariitii sobaa banuun jecha icciitii e-meelii koo akka mirkaneessu na gaafate.", "phishing"),
    ("Ergaa e-meelii sobaa yuunivarsiitii irraa fakkaatee linkii sobaa irratti jecha darbii akka jijjiiru ergame.", "phishing"),
    ("Marsariitii sobaa CBE fakkaatu irratti odeeffannoo herrega baankii koo na gaafatan.", "phishing"),
    ("Linkii shakkisiisaa Telegiraamiin dhufe irratti odeeffannoo seensaa akka galchu na gaafatan.", "phishing"),
    ("Ergaa sobaa badhaasa telekoomii qaba jedhuun linkii irratti jecha icciitii koo na gaafatan.", "phishing"),
    ("Linkii sobaa ergame banuun odeeffannoo dhuunfaa fi jecha icciitii na gaafatan.", "phishing"),
    ("Ergaa shakkisiisaa marsariitii sobaa irratti login akka godhu na dirqisiisu argadhe.", "phishing"),
    ("ከኢትዮጵያ ንግድ ባንክ የተላከ አስመሳይ አጭር መልእክት የይለፍ ቃሌን እንዳረጋግጥ አጠራጣሪ ሊንክ ላከልኝ።", "phishing"),
    ("የዩኒቨርሲቲውን ፖርታል የሚመስል የሐሰት ድረ-ገጽ ሊንክ ተልኮልኝ የይለፍ ቃሌን እንድሞላ ተጠየቅሁ።", "phishing"),
    ("በቴሌግራም የተላከሊኝ አጠራጣሪ ሊንክ ወደ ሐሰተኛ የባንክ ድረ-ገጽ በመውሰድ ሚስጥር ቁጥሬን ጠየቀኝ።", "phishing"),
    ("የኢሜይል አካውንትህ ሊዘጋ ነውና በዚህ ሊንክ አረጋግጥ የሚል የፊሺንግ መልእክት ደረሰኝ።", "phishing"),
    ("የስኮላርሺፕ ድረ-ገጽ አስመስለው የተዘጋጀ ሊንክ ላይ የይለፍ ቃሌን እንድሞላ ተጠየቅሁ።", "phishing"),
    ("የቴሌኮም አካውንት ማረጋገጫ በሚል አሳሳች ሊንክ ወደ ተጭበረበረ ገጽ መራኝ።", "phishing"),
    ("አጠራጣሪ የድረ-ገጽ ሊንክ ላይ የባንክ መግቢያ መረጃዬን እንድሞላ የሚጠይቅ መልእክት ደረሰኝ።", "phishing"),
    ("የይለፍ ቃልህን በአስቸኳይ በዚህ ሊንክ ቀይር የሚል የሐሰት ማስጠንቀቂያ ደረሰኝ።", "phishing"),

    # --- Category: sim_otp (24 samples) ---
    ("A caller claimed to be an Ethio Telecom engineer and demanded my 6-digit SMS OTP code immediately.", "sim_otp"),
    ("Received an SMS stating my SIM card will be deactivated within 12 hours unless I share verification code.", "sim_otp"),
    ("Someone called saying a network tower optimization requires my SMS confirmation code or internet cuts off.", "sim_otp"),
    ("A technician asked me to read back the one-time code sent to my phone for cellular line maintenance.", "sim_otp"),
    ("Threatened with sudden cellular disconnection unless I provide the secret OTP code from telecom.", "sim_otp"),
    ("My SIM card suddenly lost network signal and calls stopped working right after someone asked for OTP.", "sim_otp"),
    ("An unknown number called requesting the 6-digit confirmation code sent to my mobile number.", "sim_otp"),
    ("Caller claiming to be mobile telecom support urged me to forward an SMS containing a security code.", "sim_otp"),
    ("Namni Ethio Telecom irraa bilbilee koodii OTP herrega sim kaardii akka itti himu na gaafate.", "sim_otp"),
    ("Sim kaardiin kee sa'aatii 12 keessatti ni cufama, koodii mirkaneessaa dafii ergi jedhanii bilbilan.", "sim_otp"),
    ("Ogeessa telekoomiiti jedhanii koodii iccitii lakkoofsa 6 moobaayila kootti dhufe akka dubbisu na gaafatan.", "sim_otp"),
    ("Tajaajilli bilbila keessanii ni dhaabbata jechuun koodii OTP akka itti himu na sodaachisan.", "sim_otp"),
    ("Sim kaardiin koo tajaajila ala ta'eera, osoo hin cufamin koodii ergame akka himu na gaafatan.", "sim_otp"),
    ("Koodii OTP ergame osoo hin himin hafte taanaan sim kaardiin kee cufama jedhanii na gowwoomsan.", "sim_otp"),
    ("Lakkoofsa addaa irraa bilbilanii koodii mirkaneessaa telekoomii na gaafatan.", "sim_otp"),
    ("Osoo ani hin beekin sim kaardiin koo networkii dhabe, koodii OTP gaafatameen booda.", "sim_otp"),
    ("ከኢትዮ ቴሌኮም ደውያለሁ ያለ ሰው የ6 አሃዝ የኦቲፒ ሚስጥር ቁጥሬን አሁኑኑ ካልነገርከኝ መስመርህ ይዘጋል አለኝ።", "sim_otp"),
    ("ሲም ካርድዎ በ12 ሰዓት ውስጥ ይዘጋልና የተላከሎትን የማረጋገጫ ኮድ ይላኩ የሚል መልእክት ደረሰኝ።", "sim_otp"),
    ("የኔትወርክ ማስተካከያ እያደረግን ስለሆነ በስልክዎ የገባውን የሚስጥር ኦቲፒ ኮድ ንገሩን ተባልኩ።", "sim_otp"),
    ("የሲም ካርድ መዘጋት ማስጠንቀቂያ ደርሶኝ የማረጋገጫ ሚስጥር ኮዴን እንድሰጥ ተገደድኩ።", "sim_otp"),
    ("ከቴሌኮም ደንበኞች አገልግሎት ደውለናል በማለት የኦቲፒ ኮዴን እንዲያነቡልኝ ጠየቁኝ።", "sim_otp"),
    ("ያለኔ እውቀት ሲም ካርዴ ኔትወርክ አጣ፤ ከዚያ በፊት የኦቲፒ ኮድ የሚጠይቅ ስልክ ተደውሎልኝ ነበር።", "sim_otp"),
    ("የስልክ መስመርዎ እንዳይቋረጥ አሁን የተላከውን የ短信 ኮድ ይንገሩን የሚል ጥሪ ደረሰኝ።", "sim_otp"),
    ("የቴሌኮም ሰራተኛ ነኝ ያለ ግለሰብ በስልኬ የተላከውን የይለፍ ማረጋገጫ ኮድ እንድሰጠው ጠየቀኝ።", "sim_otp"),

    # --- Category: fraud (24 samples) ---
    ("A stranger called saying they accidentally transferred 3,500 Birr to my Telebirr account and demanded a refund.", "fraud"),
    ("Received a fake SMS from a personal number claiming 50,000 ETB won in Telebirr lottery with a 300 Birr fee.", "fraud"),
    ("Someone claimed to send money via CBE Birr by mistake and pressured me to dial a USSD transfer code.", "fraud"),
    ("Fraudster impersonated a merchant asking for an advance registration deposit to release a car prize.", "fraud"),
    ("Received an advance fee scam demanding a 500 Birr deposit before receiving a fictitious university grant.", "fraud"),
    ("Caller falsely claimed they sent money to my mobile wallet in error and demanded immediate cash back.", "fraud"),
    ("A fake lottery scam promised 200,000 Birr if I transferred a processing fee via Telebirr.", "fraud"),
    ("Deceived into dialing a USSD code that transferred funds out of my CBE Birr account to an unknown person.", "fraud"),
    ("Namni tokko qarshii 3,000 dogoggoraan Telebirr keetti ergeera deebisi naan jedhee na gowwoomse.", "fraud"),
    ("Ergaa sobaa Telebirr irraa Qr 50,000 badhaafamteetta, dursii kaffaltii Qr 250 ergi jedhu argadhe.", "fraud"),
    ("Maallaqatu dogoggoraan siif dhufe jechuun herrega CBE Birr koo keessaa akka baasu na dirqisiisan.", "fraud"),
    ("Badhaasa guddaa mooteetta jedhanii dursanii qarshii akka ergu na gowwoomsan.", "fraud"),
    ("Telebirr koo irraa maallaqni osoo ani hin beekin koodii USSD na ajajuun na jalaa baafame.", "fraud"),
    ("Yakkamaan baankii fakkaatee maallaqa dogoggoraan ergame deebisi jechuun qarshii na jalaa saame.", "fraud"),
    ("Gowwoomsaa Telebirr: herrega sobaa erguun maallaqni siif galeera jedhanii qarshii koo na jalaa fudhatan.", "fraud"),
    ("Badhaasa lootarii argatteetta jechuun kaffaltii qophii duraa akka kaffalu na gaafatan.", "fraud"),
    ("በስህተት 4,000 ብር ወደ ቴሌብርህ ተልኳልና አሁኑኑ መልስልኝ በሚል አጭበርባሪዎች ገንዘብ ወሰዱብኝ።", "fraud"),
    ("በቴሌብር 100,000 ብር ሎተሪ አሸንፈዋል፣ የ250 ብር የሰነድ ማስፈጸሚያ ይላኩ የሚል የማጭበርበር ጥሪ ደረሰኝ።", "fraud"),
    ("በስህተት ገንዘብ ተልኮልዎታል በማለት የUSSD ኮድ እንድደውል በማድረግ ከሲቢኢ ብር ሂሳቤ ገንዘብ ተዘረፍኩ።", "fraud"),
    ("የውሸት ሽልማት ደርሶዎታል በሚል የቅድመ ክፍያ ገንዘብ እንዳስተላልፍ ተጠየቅሁ።", "fraud"),
    ("የተሳሳተ የገንዘብ ዝውውር ተደርጓል በማለት ከቴሌብር አካውንቴ ላይ ገንዘብ አጭበርብረው ወሰዱ።", "fraud"),
    ("የንግድ ባንክ ሽልማት አሸንፈሃል በማለት የማስፈጸሚያ ክፍያ በቴሌብር እንድልክ ጠየቁኝ።", "fraud"),
    ("በስህተት የተላለፈ ገንዘብ መልስ በሚል የሀሰት የባንክ አጭር መልእክት ልከው ገንዘቤን ወሰዱብኝ።", "fraud"),
    ("የቴሌብር የሎተሪ ማጭበርበር ሰለባ ሆኜ የቅድመ ክፍያ ገንዘብ አስላኩኝ።", "fraud"),

    # --- Category: malware (24 samples) ---
    ("Downloaded a Telegram SpeedBooster APK file from a channel and it asked for full Android Accessibility permission.", "malware"),
    ("Installed an unverified banking assistant APK from an untrusted link and my phone started clicking buttons.", "malware"),
    ("A mobile app asked for dangerous device administrator and accessibility permissions upon installation.", "malware"),
    ("Downloaded a third-party APK that installed a background trojan and started intercepting SMS messages.", "malware"),
    ("Sideloaded an unverified application outside the app store and detected suspicious malware background services.", "malware"),
    ("An APK downloaded from an anonymous group asked for full screen accessibility control and file access.", "malware"),
    ("Trojan application disguised as a video player requested high-risk Android accessibility services.", "malware"),
    ("My phone is compromised after installing an untrusted APK that demanded administrator privileges.", "malware"),
    ("Appilikeeshinii APK Telegiraamii irraa buusee bilbila koo keessatti heyyama accessibility na gaafate.", "malware"),
    ("Faayila APK shakkisiisaa fe'uun bilbilli koo heyyama administrator na gaafatee ofiin hojjechuu eegale.", "malware"),
    ("Appilikeeshinii summii qabu buusuun koodii fi ergaa bilbila koo akka saamu heyyama kenneef.", "malware"),
    ("APK hin mirkanoofne Telegiraamiin dhufe fe'ee bilbilli koo vaayirasii fi summiin qabame.", "malware"),
    ("Appilikeeshinii moobaayilaa heyyama daangaa hin qabne gaafatu buusee bilbilli koo miidhame.", "malware"),
    ("APK dhuunfaa irraa buufadhee ture, ergasii ergaawwan koo ofumaan gara nama biraatti ergamuu eegalan.", "malware"),
    ("Faayila APK fe'amee ture heyyama accessibility gaafachuun odeeffannoo koo saame.", "malware"),
    ("Bilbila koo irratti appilikeeshinii summii qabu fe'amee tajaajila iccitii koo guutummaatti qabate.", "malware"),
    ("ከቴሌግራም ቻናል ያወረድኩት የኤፒኬ (APK) ፋይል የአንድሮይድ ቁጥጥር ፈቃድ (Accessibility) ጠየቀኝ።", "malware"),
    ("ያልተረጋገጠ መተግበሪያ በስልኬ ላይ ጭኜ ስልኬ ያለኔ ቁጥጥር መልእክቶችን ወደ ውጭ መላክ ጀመረ።", "malware"),
    ("ከቴሌግራም የወረደ አጠራጣሪ ኤፒኬ ፋይል በስልኬ ውስጥ ቫይረስ እና ተንኮል አዘል ሶፍትዌር አስገባብኝ።", "malware"),
    ("የመተግበሪያ ፈቃድ ከልክ በላይ የጠየቀ ኤፒኬ ከጫንኩ በኋላ የስልኬ ደህንነት አደጋ ላይ ወደቀ።", "malware"),
    ("የስልክ ማፋጠኛ የተባለ የሀሰት ኤፒኬ ፋይል አውርጄ የስልኬ አስተዳዳሪ ፈቃድ ተወሰደብኝ።", "malware"),
    ("ተንኮል አዘል የኤፒኬ መተግበሪያ በስልኬ ላይ ተጭኖ የይለፍ ቃላቶቼን እና መረጃዎቼን ሰረቀብኝ።", "malware"),
    ("ያልታወቀ የኤፒኬ ፋይል ከጫንኩ በኋላ ስልኬ በቫይረስ ተጠቃ፤ ፈቃዶችንም በግድ እየጠየቀ ተቸገርኩ።", "malware"),
    ("ከይፋዊ መደብር ውጭ የወረደ አደገኛ ኤፒኬ መተግበሪያ ስልኬን አጠቃብኝ።", "malware"),

    # --- Category: takeover (24 samples) ---
    ("My Telegram account was logged out suddenly and the password was changed by an unauthorized attacker.", "takeover"),
    ("An attacker hijacked my social media account, changed my recovery email, and locked me out completely.", "takeover"),
    ("My account password was compromised and the hacker is now messaging my contacts asking for emergency loans.", "takeover"),
    ("Lost access to my primary account because someone changed the credentials and active sessions.", "takeover"),
    ("Unauthorized login detected from another country and my profile password was changed immediately.", "takeover"),
    ("I cannot log into my account anymore; the attacker hijacked it and enabled their own 2FA authenticator.", "takeover"),
    ("Someone took over my messaging profile and is impersonating me to steal money from my friends.", "takeover"),
    ("My account was breached, credentials changed, and all my active sessions were terminated by the hacker.", "takeover"),
    ("Akkaawuntii Telegiraamii koo na jalaa cufanii jecha icciitii jijjiiruun hiriyoota kootti maallaqa kadhachaa jiru.", "takeover"),
    ("Akkaawuntiin koo hatamee jechi darbii jijjiirameera, seensas na dhowwatan.", "takeover"),
    ("Osoo ani hin beekin akkaawuntii koo keessaa na baasanii jecha icciitii haaromfatan.", "takeover"),
    ("Namni akkaawuntii koo saame maqaa kootiin namoota biraa gowwoomsaa jira.", "takeover"),
    ("Akkaawuntii e-meelii koo na jalaa fudhatanii odeeffannoo seensaa guutummaatti jijjiiran.", "takeover"),
    ("Seensa akkaawuntii koo dhabeera, yakkamaan tokko guutummaatti too'annaa jala galche.", "takeover"),
    ("Akkaawuntii koo saamuun 2FA mataa isaanii irratti hidhatanii seensa na dhowwan.", "takeover"),
    ("Akkaawuntii koo kan Telegiraamii na jalaa hatamee maallaqa kadhachuuf fayyadamaa jiru.", "takeover"),
    ("የቴሌግራም አካውንቴ በድንገት ወጣብኝ፤ የይለፍ ቃሉ ተቀይሮ አጥቂው ከጓደኞቼ ገንዘብ እየጠየቀ ነው።", "takeover"),
    ("የማህበራዊ ሚዲያ አካውንቴ ተጠልፎ የይለፍ ቃሌ ስለተቀየረብኝ ወደ አካውንቴ መግባት አልቻልኩም።", "takeover"),
    ("አካውንቴ ተሰርቆ አጥቂው የኔን ስም በመጠቀም ሰዎችን እያጭበረበረ ገንዘብ እየሰበሰበ ነው።", "takeover"),
    ("የኢሜይል አካውንቴ ተጠልፎ የማገገሚያ መረጃዬ በሙሉ ተቀይሮብኛል።", "takeover"),
    ("ያለኔ ፈቃድ ወደ አካውንቴ ገብተው የይለፍ ቃሉን በመቀየር እኔን አስወጥተው ቆለፉብኝ።", "takeover"),
    ("የአካውንት ጠለፋ ሰለባ ሆኛለሁ፤ የይለፍ ቃሉ ተቀይሯል፤ ጓደኞቼንም እያስቸገረ ነው።", "takeover"),
    ("የቴሌግራም አካውንቴ ተዘርፎ የራሳቸውን 2FA ስላደረጉበት መግባት አልቻልኩም።", "takeover"),
    ("የይለፍ ቃሌ ተሰርቆ አካውንቴ ሙሉ በሙሉ በአጥቂው ቁጥጥር ስር ውሏል።", "takeover"),
]


def train_and_evaluate_m3_model(
    corpus: Optional[List[Tuple[str, str]]] = None,
    seed: int = 42,
    epochs: int = 250,
    batch_size: int = 16,
    learning_rate: float = 0.12,
    l2_reg: float = 0.002,
) -> Tuple[SoftmaxClassifier, Dict[str, object], Dict[str, object]]:
    """
    Trains Softmax multi-class classifier on curated incident narratives.
    Evaluates on held-out 20% test split (24 records).
    """
    data = corpus or CURATED_INCIDENT_CORPUS
    rng = random.Random(seed)
    shuffled = list(data)
    rng.shuffle(shuffled)

    train_size = int(len(shuffled) * 0.8)
    train_records = shuffled[:train_size]
    test_records = shuffled[train_size:]

    X_train = [extract_incident_features(text)[0] for text, label in train_records]
    y_train = [label for text, label in train_records]

    X_test = [extract_incident_features(text)[0] for text, label in test_records]
    y_test = [label for text, label in test_records]

    model = SoftmaxClassifier(
        classes=INCIDENT_CLASSES,
        feature_names=FEATURE_GROUP_NAMES,
        learning_rate=learning_rate,
        l2_reg=l2_reg,
    )
    model.fit(X_train, y_train, epochs=epochs, batch_size=batch_size, seed=seed)

    baseline = BaselinePriorClassifier(classes=INCIDENT_CLASSES)
    baseline.fit(X_train, y_train)

    metrics = evaluate_classifier(model, X_test, y_test)
    comparison = compare_against_baseline(model, baseline, X_test, y_test)

    return model, metrics, comparison


def export_backend_json(model: SoftmaxClassifier, path: Path = BACKEND_ARTIFACT_PATH) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    model.save(path)
    return path


def export_frontend_js(
    model: SoftmaxClassifier,
    metrics: Dict[str, object],
    path: Path = FRONTEND_MIRROR_PATH,
) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    formatted_weights = "[\n"
    for row in model.weights:
        formatted_weights += "  [" + ", ".join(f"{w:.16f}" for w in row) + "],\n"
    formatted_weights += "]"

    formatted_biases = "[" + ", ".join(f"{b:.16f}" for b in model.biases) + "]"

    content = f"""/**
 * CyberShield Ethiopia — M3 Incident Report Text Classifier Weights
 * 
 * Synchronized with backend/app/data/ml_m3_incident_classifier.json.
 * Trained on trilingual curated corpus across English, Afaan Oromoo, and Amharic.
 * Zero network dependencies. Operates 100% in-browser offline for privacy preservation.
 * 
 * Held-Out Test Evaluation (24 records):
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

export const CONFIDENCE_THRESHOLD = 0.50

export const EVALUATION_METRICS = {json.dumps(metrics, indent=2)}

export const INCIDENT_KEYWORD_GROUPS = {{
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
}}

export default {{
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
}}
"""
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    return path


def main():
    parser = argparse.ArgumentParser(description="Train and export M3 Incident Text Classifier")
    parser.add_argument("--export", action="store_true", help="Export backend JSON and frontend JS artifacts")
    args = parser.parse_args()

    print("Training M3 Incident Text Classifier on curated trilingual corpus (120 records)...")
    model, metrics, comparison = train_and_evaluate_m3_model()

    print("\n--- Held-Out Test Evaluation Results (24 records) ---")
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


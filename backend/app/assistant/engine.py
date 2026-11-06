"""
CyberShield Ethiopia - Conversational AI Assistant Response Engine

Coordinates hybrid offline-first response logic, input sanitization,
sufficiency evaluation, conversation continuation, and privacy guardrails.
"""

import re
from typing import Dict, List, Optional, Tuple
from pydantic import BaseModel, ConfigDict, Field

from .knowledge import (
    KnowledgeEntry,
    find_matching_knowledge,
    get_entry_by_id,
    KNOWLEDGE_ENTRIES,
)
from .. import config

# Standard Response Status Constants
STATUS_ANSWERED_OFFLINE = "ANSWERED_OFFLINE"
STATUS_NEEDS_CLARIFICATION = "NEEDS_CLARIFICATION"
STATUS_OFFLINE_INSUFFICIENT = "OFFLINE_ANSWER_INSUFFICIENT"
STATUS_ONLINE_AVAILABLE = "ONLINE_AVAILABLE"
STATUS_ONLINE_CONSENT_REQUIRED = "ONLINE_CONSENT_REQUIRED"
STATUS_ONLINE_UNAVAILABLE = "ONLINE_UNAVAILABLE"
STATUS_ANSWER_UNAVAILABLE = "ANSWER_UNAVAILABLE"

EDUCATIONAL_DISCLAIMER_EN = (
    "Educational Guidance Only: CyberShield AI Assistant provides educational awareness and defensive guidance. "
    "It does not perform live URL scanning, does not guarantee website or account safety, and does not replace law enforcement or official emergency services."
)
EDUCATIONAL_DISCLAIMER_OM = (
    "Qajeelfama Barnootaa Qofa: Gargaaraan AI kun hubannoo saayibarii qofa kenna. "
    "Kallattiin linkii hin sakatta'u, nageenya marsariitii hin mirkaneessu, akkasumas tajaajila poolisii hin bakka bu'u."
)
EDUCATIONAL_DISCLAIMER_AM = (
    "ትምህርታዊ መመሪያ ብቻ፡ ይህ የሳይበርሺልድ AI ረዳት ግንዛቤን ለማሳደግ የተዘጋጀ ነው። "
    "የቀጥታ ድረ-ገጽ ፍተሻ አያካሂድም፣ ፍጹም የደህንነት ዋስትና አይሰጥም፣ እንዲሁም የፖሊስ ወይም የአደጋ ጊዜ አገልግሎቶችን አይተካም።"
)

DISCLAIMERS = {
    "en": EDUCATIONAL_DISCLAIMER_EN,
    "om": EDUCATIONAL_DISCLAIMER_OM,
    "am": EDUCATIONAL_DISCLAIMER_AM,
}

# Regex to detect potentially sensitive credentials or tokens in user input
PASSWORD_PATTERN = re.compile(
    r"(?i)\b(?:password|passwd|pin|secret|token|credential|passphrase)\s*(?:[:=]|is|was|equals)\s*(\S+)"
)
HIGH_ENTROPY_TOKEN = re.compile(r"\b[A-Za-z0-9+/_-]{28,}\b")
CARD_PATTERN = re.compile(r"\b(?:\d[ -]*?){13,16}\b")
URL_CHECK_INTENT = re.compile(r"(?i)\b(?:scan|check|inspect|verify|probe|test)\b.*\b(?:url|link|http|https|website|domain)\b")


class ContextTurn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(max_length=1500)
    matched_topic: Optional[str] = None


class AssistantChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    message: str = Field(min_length=1, max_length=1000)
    language: str = Field(default="en", max_length=8)
    conversation_context: List[ContextTurn] = Field(default_factory=list, max_length=6)
    online_consent: bool = False
    force_online: bool = False


class AssistantChatResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reply: str
    status: str
    engine: str  # "offline_knowledge_v1" or "online_ai"
    language: str
    matched_topic: Optional[str] = None
    suggested_followups: List[str] = Field(default_factory=list)
    online_recommended: bool = False
    online_available: bool = False
    warning: Optional[str] = None
    disclaimer: str
    offline_capable: bool = True


def detect_and_normalize_language(text: str, declared_lang: str = "en") -> str:
    """
    Detects language from text script/cues, falling back to declared language or English.
    """
    clean_decl = (declared_lang or "en").lower().strip()
    if clean_decl in ("am", "am-et", "amh"):
        fallback = "am"
    elif clean_decl in ("om", "om-et", "orm", "gaz"):
        fallback = "om"
    elif clean_decl in ("en", "en-us", "en-gb", "eng"):
        fallback = "en"
    else:
        fallback = "en"

    # Check for Ethiopic script (Amharic)
    if any("\u1200" <= ch <= "\u137f" for ch in text):
        return "am"

    # Check for Afaan Oromoo vocabulary and linguistic markers
    t_lower = text.lower()
    oromo_cues = [
        "akkam", "fiishiingii", "sobaa", "maallaqa", "eegumsa", "tajaajila",
        "jecha", "icciitii", "nageenya", "mallattoo", "dubbisi", "deebii",
        "odeeffannoo", "keessan", "keessaniin", "waan", "isin", "fakkeenyaaf",
        "akkasumas", "hoggansa", "yakkamaa", "qubeessuu", "lakkofsa", "barreessi",
        "gaaffii", "argachuuf", "ta'u", "danda'a", "jira", "jiru", "meeshaa",
        "saayibarii", "bilbila", "koodii", "cufameera", "herregni", "badhaasa"
    ]
    if any(re.search(rf"\b{re.escape(w)}\b", t_lower) for w in oromo_cues):
        return "om"

    return fallback


def sanitize_and_check_sensitive(text: str, language: str = "en") -> Tuple[str, Optional[str]]:
    """
    Sanitizes user input and redacts passwords, tokens, or credit cards.
    Returns (cleaned_text, warning_message).
    """
    cleaned = text
    warning = None

    if PASSWORD_PATTERN.search(cleaned) or CARD_PATTERN.search(cleaned) or HIGH_ENTROPY_TOKEN.search(cleaned):
        cleaned = PASSWORD_PATTERN.sub(r"password: [REDACTED_FOR_SECURITY]", cleaned)
        cleaned = CARD_PATTERN.sub("[REDACTED_CARD_NUMBER]", cleaned)
        if language == "am":
            warning = "የደህንነት ማስጠንቀቂያ፡ በመልእክትዎ ውስጥ የይለፍ ቃል ወይም ሚስጥራዊ መረጃ ተገኝቷል። ለደህንነትዎ ሲባል መረጃው ተሰርዟል። ሚስጥር ቃልዎን ለማንም አያጋሩ።"
        elif language == "om":
            warning = "Akeekkachiisa Nageenyaa: Ergaa keessan keessatti jechi icciitii ykn ragaan dhokataan argameera. Nageenya keessaniif jecha haqameera. Jecha icciitii keessan eenyuufiyyuu hin qoodinaa."
        else:
            warning = "Security Warning: CyberShield detected what appears to be a password, token, or financial credential in your message. To protect your security, this text was sanitized. Never enter passwords or credentials into AI assistants."

    return cleaned, warning


def extract_last_context_topic(context: List[ContextTurn]) -> Optional[str]:
    """Finds the most recent matched topic in the short-term conversation context."""
    for turn in reversed(context):
        if turn.matched_topic:
            return turn.matched_topic
    return None


def is_followup_question(query: str) -> Optional[str]:
    """
    Identifies whether the query is a follow-up asking for details, examples, or next steps.
    Returns: 'details', 'examples', 'next_steps', or None.
    """
    q = query.lower().strip()

    if any(p in q for p in [
        "explain further", "explain in more detail", "explain that further", "tell me more",
        "why", "why is that", "elaborate", "bal'inaan ibsi", "dabalataan", "በዝርዝር አስረዳኝ", "ተጨማሪ አብራራልኝ"
    ]):
        return "details"

    if any(p in q for p in [
        "give me an example", "show an example", "can you give an example", "example",
        "fakkeenya", "fakkeenya naaf kenni", "ምሳሌ", "ምሳሌ ስጠኝ", "ምሳሌ አሳየኝ"
    ]):
        return "examples"

    if any(p in q for p in [
        "what should i do next", "what to do next", "what next", "next steps", "how to protect",
        "how can i prepare this report", "how to prepare this report", "how do i prepare this report",
        "how can i prepare", "how do i prepare", "how to prepare", "prepare this report", "prepare report",
        "what should i include", "what to include", "how to write this report", "how to write report",
        "gabaasa akkamitti qopheessa", "akkamitti gabaasa qopheessa", "gabaasa qopheessuu", "gabaasa barreessuu",
        "tarkaanfii itti aanu", "maalan godha", "ቀጥሎ ምን ላድርግ", "ምን ማድረግ አለብኝ", "የመከላከያ እርምጃ",
        "ይህን ሪፖርት እንዴት ላዘጋጅ", "ሪፖርቱን እንዴት ላዘጋጅ", "ሪፖርት እንዴት ማዘጋጀት እችላለሁ", "ሪፖርት ማዘጋጀት", "ምን ማካተት አለብኝ"
    ]):
        return "next_steps"

    return None


def is_stay_offline_intent(text: str) -> bool:
    """Checks if the user explicitly requested to remain offline."""
    t = text.lower().strip()
    return any(p in t for p in [
        "stay offline", "remain offline", "keep offline", "offline only", "continue offline",
        "toora alaa qofaatti fufi", "toora alaan fufi", "toora alaa qofa", "toora alaa",
        "በመስመር ውጭ ብቻ ቀጥል", "በመስመር ውጭ ቀጥል", "በመስመር ውጭ ብቻ", "ከመስመር ውጭ ብቻ",
    ])


def is_explore_learn_intent(text: str) -> bool:
    """Checks if the user requested to explore Module M5 Learn."""
    t = text.lower().strip()
    return any(p in t for p in [
        "explore m5 learn", "explore learn", "m5 learn", "m5 cyber academy", "open learn", "go to learn",
        "m5 baradhu", "m5 akadaamii",
        "m5 ትምህርት", "ኤም5 ትምህርት", "ትምህርት አስስ", "ወደ m5 ትምህርት",
    ])


def is_emergency_contacts_intent(text: str) -> bool:
    """Checks if the user asked for emergency or reporting contacts."""
    t = text.lower().strip()
    return any(p in t for p in [
        "emergency contacts", "emergency contact", "emergency numbers", "emergency number",
        "who to call", "hotline", "hotlines", "reporting contacts", "official contacts",
        "lakkoofsa ariifachiisaa", "lakkoofsa bilbilaa", "bilbila ariifachiisaa",
        "የአደጋ ጊዜ ስልኮች", "የአደጋ ጊዜ ስልክ", "ስልክ ቁጥሮች", "የማሳወቂያ ስልኮች",
    ])


def evaluate_query_sufficiency(
    query: str,
    matched_entry: Optional[KnowledgeEntry],
    language: str = "en",
) -> Tuple[str, bool, Optional[str]]:
    """
    Evaluates whether the offline knowledge is sufficient to answer the question.
    Returns: (status, online_recommended, missing_details_explanation)
    """
    q_lower = query.lower().strip()

    # Case 0: Empty or vague query
    if len(q_lower.split()) <= 1 and q_lower in ("hi", "hello", "help", "selam", "akkam", "ሰላም", "እርዳታ"):
        return STATUS_NEEDS_CLARIFICATION, False, None

    # Case 1: Real-time live scanning intent (e.g., "scan this link for me right now")
    is_educational = any(ep in q_lower for ep in [
        "how does", "what is", "how to use", "explain", "tell me about", "what if", "clicked"
    ])
    if not is_educational and URL_CHECK_INTENT.search(q_lower):
        # Answerable offline with boundary explanation directing to M1
        return STATUS_ANSWERED_OFFLINE, False, None

    # Case 2: Query asks for external real-time data, current week campaigns, or live intelligence
    realtime_keywords = [
        "current campaign", "current campaigns", "recent evidence", "today", "yesterday",
        "latest live attack", "latest attack", "real-time", "live scan", "compare current",
        "yeroo ammaa", "haaraa", "የአሁኑ ዘመቻ", "የአሁኑ መረጃ", "የቅርብ ማስረጃ", "ዛሬ"
    ]
    asks_for_realtime = any(rk in q_lower for rk in realtime_keywords)

    if asks_for_realtime:
        missing = (
            "Missing: Real-time threat intelligence, current week's scam campaign tracking, and external live evidence. "
            "Offline knowledge only covers established threat patterns and protective procedures."
            if language == "en" else
            "Hanqina: Ragaa qabatamaa yeroo ammaa fi sakatta'iinsa toora intarneetii kallattii hin qabu. "
            "Gorsi toora alaa akkaataa balaa duraan beekamoo qofa qaba."
            if language == "om" else
            "ያልተሟላ መረጃ፡ የአሁናዊ ስጋት ክትትል፣ የዚህ ሳምንት የማጭበርበሪያ ዘመቻዎች እና የቀጥታ መረጃዎች ከመስመር ውጭ አልተካተቱም። "
            "የቀረበው መመሪያ ቀደም ሲል የተረጋገጡ የጥቃት አይነቶችን እና ጥንቃቄዎችን ብቻ ያብራራል።"
        )
        return STATUS_OFFLINE_INSUFFICIENT, True, missing

    # Case 3: Matched entry exists and satisfies the question
    if matched_entry is not None:
        return STATUS_ANSWERED_OFFLINE, False, None

    # Case 4: No matching entry in offline knowledge base
    missing_general = (
        "This specific query is outside the verified offline cybersecurity knowledge base of CyberShield Ethiopia."
        if language == "en" else
        "Gaaffiin kun odeeffannoo toora alaa CyberShield Ethiopia keessatti hin argamne."
        if language == "om" else
        "ይህ ጥያቄ በሳይበርሺልድ ከመስመር ውጭ እውቀት ማህደር ውስጥ አልተገኘም።"
    )
    return STATUS_OFFLINE_INSUFFICIENT, True, missing_general


def generate_offline_assistant_response(
    request: AssistantChatRequest,
) -> AssistantChatResponse:
    """
    Core hybrid response generator.
    Evaluates offline sufficiency first; returns direct offline guidance without recommending online AI
    when offline knowledge is sufficient. Only recommends online AI when there is a concrete knowledge gap.
    """
    lang = detect_and_normalize_language(request.message, request.language)
    disclaimer = DISCLAIMERS.get(lang, EDUCATIONAL_DISCLAIMER_EN)
    clean_message, warning = sanitize_and_check_sensitive(request.message, lang)
    q_lower = clean_message.lower().strip()

    # --------------------------------------------------------------------------
    # 1. Deterministic Action Intent: Stay Offline
    # --------------------------------------------------------------------------
    if is_stay_offline_intent(q_lower):
        if lang == "am":
            reply = (
                "**ተረጋግጧል፡ ሙሉ በሙሉ ከመስመር ውጭ ይቀጥላል**\n\n"
                "ጭውውትዎ በዚህ መሳሪያ ላይ ብቻ ከመስመር ውጭ እንዲቆይ ተደርጓል። ምንም አይነት መረጃ ወደ ውጭ አገልጋዮች አይላክም።\n\n"
                "የሚከተሉትን የተረጋገጡ ከመስመር ውጭ ሞጁሎች እና ትምህርቶች መመርመር ይችላሉ፡\n"
                "• **ሞጁል M1**፡ የአጠራጣሪ ሊንክ አወቃቀርን ከመስመር ውጭ መመርመር\n"
                "• **ሞጁል M2**፡ ጠንካራ የይለፍ ቃል ማመንጨት እና ጥንካሬን መፈተሽ\n"
                "• **ሞጁል M3**፡ የማስረጃ ማጠቃለያ እና የጥቃት ሪፖርት ማዘጋጀት\n"
                "• **ሞጁል M5**፡ አጫጭር የሳይበር ደህንነት ትምህርቶች እና ፈተናዎች"
            )
            followups = ["ፊሺንግ ምንድን ነው?", "የቴሌብር ማጭበርበርን እንዴት ልከላከል?", "የአደጋ ጊዜ ስልኮች"]
        elif lang == "om":
            reply = (
                "**Mirkanaa'eera: Toora Alaan Qofa Itti Fufa**\n\n"
                "Haasofni keessan guutummaatti meeshaa keessan irratti qabama. Gara intarneetiitti ergaan kamiyyuu hin ergamu.\n\n"
                "Moojuloota toora alaa armaan gadii qorachuu dandeessu:\n"
                "• **Moojulii M1**: Caasaa linkii toora alaan qorachuuf\n"
                "• **Moojulii M2**: Jecha icciitii cimaa uumuu fi qorachuuf\n"
                "• **Moojulii M3**: Ragaa qindeeffachuun gabaasa qopheessuuf\n"
                "• **Moojulii M5**: Gaaffilee saayibarii shaakaluuf"
            )
            followups = ["Fiishiingiin maali?", "Gowwoomsaa Telebirr akkamitti ittisu?", "Lakkoofsa Ariifachiisaa"]
        else:
            reply = (
                "**Confirmed: Continuing in 100% Offline Mode**\n\n"
                "Your conversation remains strictly local on this device. No network requests, queries, or logs are transmitted externally.\n\n"
                "You can continue exploring verified defensive topics locally:\n"
                "• **Module M1**: Inspect suspicious link structure and heuristics offline\n"
                "• **Module M2**: Test passphrase entropy and generate secure credentials\n"
                "• **Module M3**: Draft evidence-backed incident reports\n"
                "• **Module M5**: Take interactive cybersecurity quizzes in Cyber Academy"
            )
            followups = ["What is phishing?", "How do I secure Telebirr / CBE Birr?", "Emergency Contacts"]

        return AssistantChatResponse(
            reply=reply,
            status=STATUS_ANSWERED_OFFLINE,
            engine="offline_knowledge_v1",
            language=lang,
            matched_topic=None,
            suggested_followups=followups,
            online_recommended=False,
            online_available=bool(getattr(config, "ASSISTANT_ONLINE_ENABLED", False)),
            warning=warning,
            disclaimer=disclaimer,
            offline_capable=True,
        )

    # --------------------------------------------------------------------------
    # 2. Deterministic Action Intent: Explore M5 Learn
    # --------------------------------------------------------------------------
    if is_explore_learn_intent(q_lower):
        learn_entry = get_entry_by_id("m5_learn_quizzes")
        if learn_entry:
            title = learn_entry.title.get(lang) or learn_entry.title.get("en", "Module M5 — Cyber Academy & Quizzes")
            if lang == "am":
                body = (
                    f"**{title}**\n\n"
                    "ሞጁል M5 አጫጭር ትምህርቶችንና ፈተናዎችን በ5 ዋና ዋና ዘርፎች ያቀርባል፡\n"
                    "1. **ፊሺንግ እና አሳሳች ሊንኮች**፡ የሐሰት ባንክ መልእክቶችን እና የይለፍ ቃል ማጥመጃዎችን መለየት።\n"
                    "2. **የይለፍ ቃል ደህንነት**፡ ጠንካራ የይለፍ ቃላትን እና ባለሁለት ደረጃ ማረጋገጫን (2FA) መጠቀም።\n"
                    "3. **የጥቃት ምላሽ**፡ ጥቃት ሲያጋጥም መረጃዎችን ማሰባሰብ እና ሪፖርት ማድረግ።\n"
                    "4. **የድረ-ገጽ ደህንነት**፡ የTLS ምስጠራን፣ HSTS እና CSPን መረዳት።\n"
                    "5. **የሞባይል ባንኪንግ ጥበቃ**፡ የቴሌብር እና ሲቢኢ ብር ደህንነት እንዲሁም የሲም ስዋፕ መከላከያ።\n\n"
                    "ትምህርቱን ለመጀመር ከማውጫው ላይ **ትምህርት (Learn)** የሚለውን ይምረጡ ወይም ከታች ያለውን ቁልፍ ይጠቀሙ።"
                )
            elif lang == "om":
                body = (
                    f"**{title}**\n\n"
                    "Moojuliin M5 barnoota fi gaaffilee qormaataa damee 5 irratti dhiyeessa:\n"
                    "1. **Fiishiingii fi Linkii Sobaa**: Ergaa sobaa fi kiyyoo linkii adda baasuu.\n"
                    "2. **Nageenya Jecha Icciitii**: Passphrase cimaa fi mirkaneessa lammataa (2FA) fayyadamuu.\n"
                    "3. **Deebii Balaa**: Yeroo balaan ga'u tarkaanfii fudhatamu fi ragaa qabachuu.\n"
                    "4. **Nageenya Marsariitii**: TLS, HSTS fi CSP hubachuu.\n"
                    "5. **Amala Gaarii Intarneetii**: Eegumsa Telebirr fi Kaardii SIM.\n\n"
                    "Gara barnoota M5 deemuuf baafata irraa **Learn** filadhaa ykn qabduu armaan gadii tuqaa."
                )
            else:
                body = (
                    f"**{title}**\n\n"
                    "Module M5 delivers bite-sized interactive lessons and quizzes across five defensive domains:\n"
                    "1. **Phishing & Scam Links**: Spot fake bank SMS, spoofed domains, and credential harvest forms.\n"
                    "2. **Password Security**: Master passphrase length, entropy, and multi-factor authentication (2FA).\n"
                    "3. **Incident Response**: Contain account breaches, preserve evidence, and report fraud.\n"
                    "4. **Website Defense**: Understand TLS encryption, HSTS headers, and Content Security Policies.\n"
                    "5. **Safe Digital Habits**: Defend mobile wallets (Telebirr/CBE Birr) and prevent SIM swaps.\n\n"
                    "Navigate to **Learn** in the navigation bar to start interactive challenges and earn defensive XP offline."
                )
            followups = learn_entry.suggested_followups.get(lang, ["Tell me about Cyber Hero Journey", "How do I earn XP?", "What should I do next?"])

            return AssistantChatResponse(
                reply=body,
                status=STATUS_ANSWERED_OFFLINE,
                engine="offline_knowledge_v1",
                language=lang,
                matched_topic="m5_learn_quizzes",
                suggested_followups=followups,
                online_recommended=False,
                online_available=bool(getattr(config, "ASSISTANT_ONLINE_ENABLED", False)),
                warning=warning,
                disclaimer=disclaimer,
                offline_capable=True,
            )

    # --------------------------------------------------------------------------
    # 3. Deterministic Action Intent: Emergency Contacts
    # --------------------------------------------------------------------------
    if is_emergency_contacts_intent(q_lower):
        contacts_entry = get_entry_by_id("reporting_contacts_ethiopia")
        if contacts_entry:
            title = contacts_entry.title.get(lang) or contacts_entry.title.get("en", "Official Cybersecurity & Fraud Contacts in Ethiopia")
            if lang == "am":
                body = (
                    f"**{title}**\n\n"
                    "የሳይበር ጥቃት፣ የገንዘብ ማጭበርበር ወይም አጠራጣሪ ወንጀል ካጋጠመዎት ወደ እነዚህ ይፋዊ መስመሮች ይደውሉ፡\n\n"
                    "• **የመረጃ መረብ ደህንነት አስተዳደር (INSA / CERT-ET)**፡ በ **933** ይደውሉ\n"
                    "• **ኢትዮ ቴሌኮም (የደንበኞች አገልግሎት / ሲም ስዋፕ / ቴሌብር)**፡ በ **994** ይደውሉ\n"
                    "• **የኢትዮጵያ ንግድ ባንክ (የማጭበርበር ሪፖርት መስመር)**፡ በ **951** ይደውሉ\n"
                    "• **ፌዴራል ፖሊስ (የሳይበር ወንጀል ምርመራ ክፍል)**፡ በ **991** ይደውሉ\n\n"
                    "### የሚመከሩ አፋጣኝ እርምጃዎች፡\n"
                    "1. የትራንዛክሽን ቁጥሮችንና የአጥቂውን ስልክ ወይም የቴሌግራም አድራሻ ይያዙ።\n"
                    "2. ከመደወልዎ በፊት በ **ሞጁል M3 (የጥቃት ሪፖርት ማዘጋጃ)** ማስረጃዎችን ያደራጁ።\n"
                    "3. በማጭበርበሪያ ጥሪዎች ወይም መልእክቶች ተገፋፍተው ምንም ተጨማሪ ገንዘብ እንዳይልኩ።"
                )
            elif lang == "om":
                body = (
                    f"**{title}**\n\n"
                    "Balaan saayibarii ykn gowwoomsaan maallaqaa yoo isin mudate, sarara bilbilaa mootummaa kanneen bilbilaa:\n\n"
                    "• **INSA / CERT-ET (Tajaajila Nageenya Saayibarii Biyyooleessaa)**: Bilbilaa **933**\n"
                    "• **Ethio Telecom (Tajaajila Maamilaa / Kaardii SIM / Telebirr)**: Bilbilaa **994**\n"
                    "• **Baankii Daldala Itoophiyaa (CBE Desk Saamichaa)**: Bilbilaa **951**\n"
                    "• **Poolisii Federaalaa (Damee Qorannoo Yakka Saayibarii)**: Bilbilaa **991**\n\n"
                    "### Tarkaanfiiwwan Dursa Fudhataman:\n"
                    "1. Lakkoofsa transaction fi bilbila yakkamaa qabadhaa.\n"
                    "2. Osoo hin bilbilin dura **Moojulii M3** fayyadamuun ragaa qindeeffadhaa.\n"
                    "3. Yakkamaaf maallaqa dabalataa matumaa hin dabarsinaa."
                )
            else:
                body = (
                    f"**{title}**\n\n"
                    "If you are facing active cyber threats, extortion, or financial fraud in Ethiopia, contact these official hotlines:\n\n"
                    "• **INSA / CERT-ET (National Cyber Incident Response)**: Dial **933**\n"
                    "• **Ethio Telecom Customer Care (SIM Swap & Telebirr Disputes)**: Dial **994**\n"
                    "• **Commercial Bank of Ethiopia (CBE Fraud Desk)**: Dial **951**\n"
                    "• **Federal Police Cyber Crime Division**: Dial **991**\n\n"
                    "### Recommended Immediate Actions:\n"
                    "1. Note down transaction IDs, phone numbers, and suspect handles.\n"
                    "2. Use **Module M3 (Incident Report Assistant)** to assemble an evidence draft before calling.\n"
                    "3. Never transfer additional money under fraudster pressure."
                )
            followups = contacts_entry.suggested_followups.get(lang, ["How to use M3 Incident Report?", "What is SIM swap?", "What should I do next?"])

            return AssistantChatResponse(
                reply=body,
                status=STATUS_ANSWERED_OFFLINE,
                engine="offline_knowledge_v1",
                language=lang,
                matched_topic="reporting_contacts_ethiopia",
                suggested_followups=followups,
                online_recommended=False,
                online_available=bool(getattr(config, "ASSISTANT_ONLINE_ENABLED", False)),
                warning=warning,
                disclaimer=disclaimer,
                offline_capable=True,
            )

    # --------------------------------------------------------------------------
    # 4. Handle live URL scan intent directly and safely (excluding educational queries)
    # --------------------------------------------------------------------------
    is_educational_url_query = any(ep in q_lower for ep in [
        "how does", "what is", "how to use", "explain", "tell me about", "what if", "clicked", "already clicked"
    ])
    if not is_educational_url_query and URL_CHECK_INTENT.search(q_lower):
        if lang == "am":
            reply_text = (
                "የደህንነት ማሳሰቢያ፡ የሳይበርሺልድ AI ረዳት የቀጥታ ድረ-ገጾችን ወይም ሊንኮችን በራስ-ሰር አይመረምርም።\n\n"
                "አጠራጣሪ ሊንክን ለመፈተሽ፣ እባክዎ በዋናው ማውጫ ላይ የሚገኘውን **ሞጁል M1 (አጠራጣሪ ሊንክ መመርመሪያ)** ይጠቀሙ። "
                "M1 የሊንኩን ቅርጽ እና የቁጥር አድራሻዎች (IP) ከመስመር ውጭ ይመረምራል፤ ድረ-ገጹን በጭራሽ አይከፍተውም።\n\n"
                "አስፈላጊ፡ M1 'ንጹህ' ቢል እንኳን ድረ-ገጹ 100% አስተማማኝ ነው ማለት አይደለም።"
            )
            followups = ["M1 እንዴት ይሰራል?", "ሊንኩን አስቀድሜ ነክቼው ከሆነስ?", "ቀጥሎ ምን ማድረግ አለብኝ?"]
        elif lang == "om":
            reply_text = (
                "Hubachiisa Nageenyaa: Gargaaraan AI kun kallattiin linkii hin sakatta'u.\n\n"
                "Linkii shakkisiisaa ta'e qorachuuf, baafata irraa **Moojulii M1 (Sakatta'aa Linkii Sobaa)** fayyadamaa. "
                "M1 caasaa linkichaa toora alaan qorata malee linkicha matumaa hin banu.\n\n"
                "Hubadhu: M1 nagaa yoo jedheyyuu linkichi 100% amansiisaa ta'uu isaa hin mirkaneessu."
            )
            followups = ["M1 akkamitti hojjeta?", "Yoon linkicha baneera ta'e hoo?", "Tarkaanfii itti aanu maalan godha?"]
        else:
            reply_text = (
                "Safety Notice: CyberShield AI Assistant does not perform live URL scanning, crawling, or network probing.\n\n"
                "To inspect a suspicious link safely, navigate to **Module M1 (Suspicious Link Checker)** in the application. "
                "M1 evaluates URL structure, embedded credentials, and domain heuristics offline without connecting to the remote host.\n\n"
                "Note: A clean heuristic check in M1 is an indicator, not a guarantee of safety."
            )
            followups = ["How does M1 Link Checker work?", "What if I already clicked a suspicious link?", "What should I do next?"]

        return AssistantChatResponse(
            reply=reply_text,
            status=STATUS_ANSWERED_OFFLINE,
            engine="offline_knowledge_v1",
            language=lang,
            matched_topic="m1_link_checker",
            suggested_followups=followups,
            online_recommended=False,
            online_available=bool(getattr(config, "ASSISTANT_ONLINE_ENABLED", False)),
            warning=warning,
            disclaimer=disclaimer,
            offline_capable=True,
        )

    # --------------------------------------------------------------------------
    # 5. Check for follow-up continuation using short-term conversation context
    # --------------------------------------------------------------------------
    followup_type = is_followup_question(clean_message)
    last_topic_id = extract_last_context_topic(request.conversation_context)

    # Only treat as contextual followup if the message itself is NOT asking about a specific new topic
    direct_match = find_matching_knowledge(clean_message, lang)

    is_generic_followup = followup_type and (
        direct_match is None
        or (last_topic_id and direct_match.id == "what_to_do_clicked_link" and "link" not in clean_message.lower())
    )

    if is_generic_followup:
        if last_topic_id:
            entry = get_entry_by_id(last_topic_id)
            if entry:
                if followup_type == "details":
                    section_text = entry.details.get(lang) or entry.details.get("en", "")
                    header = "Detailed Explanation:" if lang == "en" else "Ibsa Bal'aa:" if lang == "om" else "ዝርዝር ማብራሪያ፡"
                elif followup_type == "examples":
                    section_text = entry.examples.get(lang) or entry.examples.get("en", "")
                    header = "Practical Example:" if lang == "en" else "Fakkeenya Qabatamaa:" if lang == "om" else "ተግባራዊ ምሳሌ፡"
                else:  # next_steps
                    section_text = entry.next_steps.get(lang) or entry.next_steps.get("en", "")
                    header = "Recommended Next Steps:" if lang == "en" else "Tarkaanfiiwwan Itti Aanan:" if lang == "om" else "የሚመከሩ ቀጣይ እርምጃዎች፡"

                topic_title = entry.title.get(lang) or entry.title.get("en", entry.id)
                reply = f"**{topic_title}**\n\n### {header}\n{section_text}"
                followups = entry.suggested_followups.get(lang, ["What should I do next?", "Give me an example"])

                return AssistantChatResponse(
                    reply=reply,
                    status=STATUS_ANSWERED_OFFLINE,
                    engine="offline_knowledge_v1",
                    language=lang,
                    matched_topic=entry.id,
                    suggested_followups=followups,
                    online_recommended=False,
                    online_available=bool(getattr(config, "ASSISTANT_ONLINE_ENABLED", False)),
                    warning=warning,
                    disclaimer=disclaimer,
                    offline_capable=True,
                )

        # Followup requested but no previous topic in context -> ask for clarification politely
        if lang == "am":
            reply = (
                "የምን ርዕስ ምሳሌ ወይም ቀጣይ እርምጃ እንዲብራራሎት ይፈልጋሉ? "
                "እባክዎ የተለየ ርዕስ ይጥቀሱ (ለምሳሌ፡ ፊሺንግ፣ የቴሌብር ማጭበርበር፣ ወይም የይለፍ ቃል ጥንካሬ)።"
            )
            followups = ["የፊሺንግ ምሳሌ ስጠኝ", "የቴሌብር ማጭበርበር ምሳሌ", "የይለፍ ቃል ምሳሌ"]
        elif lang == "om":
            reply = (
                "Mee mata-duree kam irratti fakkeenya ykn tarkaanfii barbaaddu? "
                "Mata-duree ifa ta'e filadhaa (fakkeenyaaf: fiishiingii, gowwoomsaa Telebirr, ykn jecha icciitii)።"
            )
            followups = ["Fakkeenya fiishiingii", "Fakkeenya gowwoomsaa Telebirr", "Fakkeenya password"]
        else:
            reply = (
                "Which cybersecurity topic would you like an example or next steps for? "
                "Please mention a topic or select one below:"
            )
            followups = ["Give me a phishing example", "Give me a Telebirr scam example", "Give me a password example"]

        return AssistantChatResponse(
            reply=reply,
            status=STATUS_NEEDS_CLARIFICATION,
            engine="offline_knowledge_v1",
            language=lang,
            matched_topic=None,
            suggested_followups=followups,
            online_recommended=False,
            online_available=bool(getattr(config, "ASSISTANT_ONLINE_ENABLED", False)),
            warning=warning,
            disclaimer=disclaimer,
            offline_capable=True,
        )

    # --------------------------------------------------------------------------
    # 6. Direct knowledge match evaluation & Sufficiency Evaluation
    # --------------------------------------------------------------------------
    matched_entry = direct_match or find_matching_knowledge(clean_message, lang)
    status, online_recommended, missing_exp = evaluate_query_sufficiency(clean_message, matched_entry, lang)

    # Case A: Vague / clarification
    if status == STATUS_NEEDS_CLARIFICATION:
        if lang == "am":
            reply = (
                "ሰላም! እኔ የሳይበርሺልድ AI ረዳት ነኝ። በሳይበር ደህንነት፣ በአጠራጣሪ ሊንኮች፣ በይለፍ ቃል ጥንካሬ እና በማጭበርበር መከላከያ ዙሪያ ሊረዱዎት እችላለሁ።\n\n"
                "እባክዎ የተለየ ጥያቄ ይጠይቁ ወይም ከታች ካሉት አማራጮች አንዱን ይምረጡ፡"
            )
            followups = ["ፊሺንግ ምንድን ነው?", "የቴሌብር ማጭበርበርን እንዴት ልከላከል?", "M1 ሊንክ መመርመሪያ እንዴት ይሰራል?"]
        elif lang == "om":
            reply = (
                "Akkam! Ani Gargaaraa Saayibarii CyberShield ti. Waa'ee nageenya saayibarii, linkii sobaa, jecha icciitii fi gowwoomsaa ittisuu irratti si gargaaruun danda'a.\n\n"
                "Mee gaaffii kee ifatti naaf barreessi ykn kanneen armaan gadii keessaa filadhu:"
            )
            followups = ["Fiishiingiin maali?", "Gowwoomsaa Telebirr akkamitti ittisu?", "M1 akkamitti hojjeta?"]
        else:
            reply = (
                "Hello! I am the CyberShield AI Assistant. I can help explain cybersecurity topics, suspicious link detection, password security, and fraud protection in Ethiopia.\n\n"
                "Please ask a specific question or select one of the suggested topics below:"
            )
            followups = ["What is phishing?", "How do I secure Telebirr / CBE Birr?", "How does M1 Link Checker work?"]

        return AssistantChatResponse(
            reply=reply,
            status=STATUS_NEEDS_CLARIFICATION,
            engine="offline_knowledge_v1",
            language=lang,
            matched_topic=None,
            suggested_followups=followups,
            online_recommended=False,
            online_available=bool(getattr(config, "ASSISTANT_ONLINE_ENABLED", False)),
            warning=warning,
            disclaimer=disclaimer,
            offline_capable=True,
        )

    # Case B: Offline answer is fully sufficient
    if status == STATUS_ANSWERED_OFFLINE and matched_entry is not None:
        title = matched_entry.title.get(lang) or matched_entry.title.get("en", "")
        summary = matched_entry.summary.get(lang) or matched_entry.summary.get("en", "")

        if matched_entry.id == "what_to_do_clicked_link":
            details = matched_entry.details.get(lang) or matched_entry.details.get("en", "")
            reply = f"**{title}**\n\n{summary}\n\n{details}"
        elif matched_entry.id == "m3_incident_report" and any(rp in q_lower for rp in ["prepare", "how", "step", "draft", "structure", "write", "qopheess", "ማዘጋጀት", "እንዴት", "ምን"]):
            details = matched_entry.details.get(lang) or matched_entry.details.get("en", "")
            next_st = matched_entry.next_steps.get(lang) or matched_entry.next_steps.get("en", "")
            guide_header = "Structured Incident Report Guide:" if lang == "en" else "Qajeelfama Gabaasa Balaa:" if lang == "om" else "የተደራጀ የጥቃት ሪፖርት መመሪያ፡"
            reply = f"**{title}**\n\n{summary}\n\n### {guide_header}\n{details}\n\n{next_st}"
        else:
            reply = f"**{title}**\n\n{summary}"

        followups = matched_entry.suggested_followups.get(lang, ["Explain further", "Give me an example", "What should I do next?"])

        return AssistantChatResponse(
            reply=reply,
            status=STATUS_ANSWERED_OFFLINE,
            engine="offline_knowledge_v1",
            language=lang,
            matched_topic=matched_entry.id,
            suggested_followups=followups,
            online_recommended=False,
            online_available=bool(getattr(config, "ASSISTANT_ONLINE_ENABLED", False)),
            warning=warning,
            disclaimer=disclaimer,
            offline_capable=True,
        )

    # --------------------------------------------------------------------------
    # 7. Offline answer is insufficient or query is outside verified local scope
    # --------------------------------------------------------------------------
    online_available = bool(getattr(config, "ASSISTANT_ONLINE_ENABLED", False))
    missing_note = missing_exp or "Offline knowledge is limited on this query."

    # If an entry matched partially (e.g. asking for current campaigns on phishing), include base offline knowledge
    if matched_entry:
        title = matched_entry.title.get(lang) or matched_entry.title.get("en", "")
        summary = matched_entry.summary.get(lang) or matched_entry.summary.get("en", "")
        base_answer = f"**{title} (Offline Knowledge)**\n\n{summary}\n\n"
    else:
        base_answer = (
            "**Offline Limitation Notice**\n\n"
            if lang == "en" else
            "**Hubachiisa Hanqina Toora Alaa**\n\n"
            if lang == "om" else
            "**የከመስመር ውጭ መረጃ ገደብ**\n\n"
        )

    # Check if the query is a general non-cybersecurity question
    cyber_terms = [
        "cyber", "security", "cybersecurity", "saayibarii", "nageenya", "ሳይበር", "ደህንነት",
        "hack", "hacker", "hacking", "haakingii", "ሀከር", "ሀኪንግ",
        "scam", "fraud", "phish", "fishing", "fiishiingii", "ማጭበርበር", "ፊሺንግ",
        "link", "url", "website", "domain", "marsariitii", "ሊንክ", "ድረ-ገጽ",
        "password", "passphrase", "pin", "otp", "2fa", "mfa", "jecha icciitii", "የይለፍ ቃል", "ሚስጥር",
        "telebirr", "cbe", "bank", "baankii", "ባንክ", "ቴሌብር", "ሲቢኢ",
        "sim", "sim swap", "kaardii", "ሲም", "ስዋፕ",
        "malware", "ransomware", "spyware", "virus", "trojan", "vaayirasii", "ማልዌር", "ራንሰምዌር", "ቫይረስ",
        "cia", "confidentiality", "integrity", "availability", "triad", "icciitii", "sirrummaa",
        "auth", "authentication", "authorization", "mirkaneessa", "heeyyama", "ማረጋገጫ", "ፈቃድ",
        "privacy", "pii", "personal data", "ragaa dhuunfaa", "የግል መረጃ", "ሚስጥራዊነት",
        "threat", "vulnerability", "risk", "attack", "sodaa", "hanqina", "balaa", "ስጋት", "ክፍተት", "አደጋ",
        "boundary", "boundaries", "limit", "limitation", "daangaa", "ወሰን", "ወሰኖች", "ገደብ",
        "learn", "roadmap", "career", "study", "academy", "baradhu", "barnoota", "መማር", "ትምህርት",
        "ethical", "white hat", "black hat", "seera qabeessa", "ህጋዊ", "ወንጀል",
        "disclosure", "report", "cert", "insa", "police", "poolisii", "gabaasa", "ፖሊስ", "ኢንሳ", "ሪፖርት",
        "wifi", "wi-fi", "network", "vpn", "firewall", "netwoorkii", "ዋይፋይ", "ኔትወርክ", "ቪፒኤን", "ፋየርዎል"
    ]
    is_cyber_related = any(ct in q_lower for ct in cyber_terms) or (matched_entry is not None)

    if not is_cyber_related:
        if lang == "am":
            explanation = (
                f"{base_answer}**ከሳይበር ደህንነት ወሰን ውጭ የሆነ ጥያቄ**\n\n"
                "ሳይበርሺልድ ኢትዮጵያ ከተረጋገጠ ከመስመር ውጭ (offline) የሳይበር ደህንነት ትምህርት ይመልሳል። ይህ ጥያቄ ከመስመር ውጭ ማህደራችን ወሰን ውጭ ነው።\n\n"
                "በሚከተሉት ርዕሶች ዙሪያ መጠየቅ ይችላሉ፡\n"
                "• የፊሺንግ ሊንኮች እና የኤስኤምኤስ ማጭበርበር\n"
                "• የቴሌብር እና ሲቢኢ ብር ደህንነት\n"
                "• ጠንካራ የይለፍ ቃል (ሞጁል M2)\n"
                "• አጠራጣሪ ሊንክ ከከፈቱ የሚወሰዱ እርምጃዎች\n"
                "• የአደጋ ጊዜ ስልኮች (ሞጁል M3)"
            )
            followups = ["ፊሺንግ ምንድን ነው?", "ሊንኩን አስቀድሜ ነክቼው ከሆነስ?", "የአደጋ ጊዜ ስልኮች"]
        elif lang == "om":
            explanation = (
                f"{base_answer}**Mata-duree Saayibariitiin Alatti**\n\n"
                "CyberShield Ethiopia odeeffannoo toora alaa (offline) nageenya saayibarii qofa kenna. Gaaffiin kun odeeffannoo toora alaa keessatti hin argamu.\n\n"
                "Waa'ee kanneen armaan gadii gaafachuu dandeessu:\n"
                "• Fiishiingii fi linkii sobaa\n"
                "• Nageenya Telebirr fi CBE Birr\n"
                "• Jecha icciitii cimaa (Moojulii M2)\n"
                "• Linkii shakkisiisaa yoo tuqxan maal gochuu akka qabdan\n"
                "• Lakkoofsa ariifachiisaa (Moojulii M3)"
            )
            followups = ["Fiishiingiin maali?", "Yoon linkii shakkisiisaa baneera ta'e hoo?", "Lakkoofsa Ariifachiisaa"]
        else:
            explanation = (
                f"{base_answer}**Outside Cybersecurity Scope**\n\n"
                "CyberShield Ethiopia answers from verified offline cybersecurity knowledge by default. This query is outside our local offline defensive knowledge base.\n\n"
                "You can ask about:\n"
                "• Phishing links & SMS fraud\n"
                "• Securing Telebirr, CBE Birr & mobile banking\n"
                "• Password entropy & generation (Module M2)\n"
                "• Incident triage if you clicked a suspicious link\n"
                "• Official cybersecurity contacts (Module M3)"
            )
            followups = ["What is phishing?", "What if I already clicked a suspicious link?", "Emergency Contacts"]
    else:
        if lang == "am":
            explanation = (
                f"{base_answer}⚠️ **የጎደለ መረጃ**፡ {missing_note}\n\n"
                "ሳይበርሺልድ ኢትዮጵያ በመጀመሪያ ከተረጋገጠ ከመስመር ውጭ (offline) እውቀት ይመልሳል። "
                "የቅርብ ጊዜ የማጭበርበሪያ ዘመቻዎችን ወይም የቀጥታ መረጃዎችን ለማግኘት የኦንላይን AI ማማከር ይቻላል።"
            )
            followups = ["በመስመር ውጭ ብቻ ቀጥል", "M5 ትምህርት", "የአደጋ ጊዜ ስልኮች"]
        elif lang == "om":
            explanation = (
                f"{base_answer}⚠️ **Odeeffannoo Hanqate**፡ {missing_note}\n\n"
                "CyberShield Ethiopia dura odeeffannoo toora alaa (offline) irraa deebii kenna. "
                "Odeeffannoo dabalataatiif AI toora intarneetii fayyadamuun ni danda'ama."
            )
            followups = ["Toora alaa qofaatti fufi", "M5 Baradhu", "Lakkoofsa Ariifachiisaa"]
        else:
            explanation = (
                f"{base_answer}⚠️ **Offline Information Boundary**:\n{missing_note}\n\n"
                "CyberShield Ethiopia answers from verified offline knowledge by default. "
                "To explore recent campaigns or details beyond this local dataset, Online AI is available as an optional step."
            )
            followups = ["Stay offline", "Explore M5 Learn", "Emergency Contacts"]

    return AssistantChatResponse(
        reply=explanation,
        status=STATUS_OFFLINE_INSUFFICIENT,
        engine="offline_knowledge_v1",
        language=lang,
        matched_topic=matched_entry.id if matched_entry else None,
        suggested_followups=followups,
        online_recommended=True,
        online_available=online_available,
        warning=warning,
        disclaimer=disclaimer,
        offline_capable=True,
    )

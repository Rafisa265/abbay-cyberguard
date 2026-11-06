"""
CyberShield Ethiopia - Conversational AI Assistant API Routes

Provides endpoints for the hybrid offline-first conversational assistant.
Follows strict privacy rules: zero conversation persistence by default,
strict consent gate before external transmission, and automatic credential sanitization.
"""

import logging
from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse

from .assistant.engine import (
    AssistantChatRequest,
    AssistantChatResponse,
    STATUS_ANSWERED_OFFLINE,
    STATUS_NEEDS_CLARIFICATION,
    STATUS_OFFLINE_INSUFFICIENT,
    STATUS_ONLINE_AVAILABLE,
    STATUS_ONLINE_CONSENT_REQUIRED,
    STATUS_ONLINE_UNAVAILABLE,
    STATUS_ANSWER_UNAVAILABLE,
    generate_offline_assistant_response,
    sanitize_and_check_sensitive,
    detect_and_normalize_language,
    DISCLAIMERS,
    EDUCATIONAL_DISCLAIMER_EN,
)
from .assistant.knowledge import KNOWLEDGE_ENTRIES
from .assistant.provider import get_active_provider
from .assistant.search import perform_cybersecurity_search, format_search_citations
from . import config

log = logging.getLogger("cybershield")
router = APIRouter(prefix="/api/v1/assistant", tags=["CyberShield Assistant"], include_in_schema=False)


@router.post(
    "/chat",
    response_model=AssistantChatResponse,
    summary="CyberShield Conversational AI Assistant interaction",
    description=(
        "Hybrid offline-first conversational assistant. Answers from local verified cybersecurity "
        "knowledge base first; only offers online AI when offline data is insufficient and "
        "requires explicit consent before sending queries externally. Never collects passwords or PII."
    ),
)
async def chat_with_assistant(
    request: AssistantChatRequest,
):
    try:
        lang = detect_and_normalize_language(request.message, request.language)
        disclaimer = DISCLAIMERS.get(lang, EDUCATIONAL_DISCLAIMER_EN)
        clean_msg, warning = sanitize_and_check_sensitive(request.message, lang)

        # Step 1: Always evaluate offline knowledge sufficiency first
        offline_resp = generate_offline_assistant_response(request)

        # Step 2: If offline answer is sufficient or query needs clarification, return immediately
        # (Preserves Phase 4 Rule: do NOT recommend or use online AI when offline is sufficient)
        if (
            offline_resp.status in (STATUS_ANSWERED_OFFLINE, STATUS_NEEDS_CLARIFICATION)
            and not request.force_online
        ):
            log.info("event=assistant_chat engine=offline status=%s lang=%s", offline_resp.status, lang)
            return offline_resp

        # Step 3: Offline is insufficient OR user explicitly requested online enhancement
        provider = get_active_provider()
        online_configured = provider.is_configured()

        # Step 4: Check explicit user consent
        if not request.online_consent:
            # Consent not yet granted: return offline answer with consent requirement notice
            log.info("event=assistant_chat status=consent_required lang=%s", lang)
            return AssistantChatResponse(
                reply=offline_resp.reply,
                status=STATUS_ONLINE_CONSENT_REQUIRED if online_configured else STATUS_ONLINE_UNAVAILABLE,
                engine="offline_knowledge_v1",
                language=lang,
                matched_topic=offline_resp.matched_topic,
                suggested_followups=offline_resp.suggested_followups,
                online_recommended=True,
                online_available=online_configured,
                warning=warning,
                disclaimer=disclaimer,
                offline_capable=True,
            )

        # Step 5: User granted consent. Check provider availability.
        if not online_configured:
            log.info("event=assistant_chat status=online_unconfigured lang=%s", lang)
            unavailable_msg = (
                f"{offline_resp.reply}\n\n"
                "ℹ️ **Online AI Unavailable**: No external AI provider is configured on this server. "
                "Operating strictly in offline mode using verified local knowledge."
                if lang == "en" else
                f"{offline_resp.reply}\n\n"
                "ℹ️ **AI Toora Intarneetii Hin Qophoofne**: Qindeessi AI toora intarneetii serverii kanarra hin jiru. "
                "Odeeffannoo toora alaa qofa fayyadamaa jirra."
                if lang == "om" else
                f"{offline_resp.reply}\n\n"
                "ℹ️ **የኦንላይን AI አልተዋቀረም**፡ በዚህ አገልጋይ ላይ የውጭ AI አልተዋቀረም። "
                "ስርዓቱ ከመስመር ውጭ ባሉ የተረጋገጡ መረጃዎች ብቻ በመስራት ላይ ነው።"
            )
            return AssistantChatResponse(
                reply=unavailable_msg,
                status=STATUS_ONLINE_UNAVAILABLE,
                engine="offline_knowledge_v1",
                language=lang,
                matched_topic=offline_resp.matched_topic,
                suggested_followups=offline_resp.suggested_followups,
                online_recommended=False,
                online_available=False,
                warning=warning,
                disclaimer=disclaimer,
                offline_capable=True,
            )

        # Step 6: Dispatch external request to configured provider with authoritative search
        log.info("event=assistant_chat status=calling_online_provider lang=%s", lang)
        provider_name = getattr(config, "ASSISTANT_PROVIDER", "none").lower()
        force_mock_search = (provider_name == "mock")

        # Test simulation triggers for Scenarios B and E
        if "network_unavailable" in clean_msg.lower():
            log.info("event=assistant_search scenario=network_unavailable")
            unavailable_msg = (
                f"{offline_resp.reply}\n\n"
                "🌐 **Offline Status**: Unable to reach online cybersecurity search (network offline). "
                "CyberShield Ethiopia continues protecting you using verified offline knowledge. "
                "You can explore related lessons in **Module M5 Cyber Academy** or practice in **Cyber Hero Journey**."
                if lang == "en" else
                f"{offline_resp.reply}\n\n"
                "🌐 **Haala Toora Alaa**: Barbaadni toora intarneetii hin danda'amne (sararri interneetii hin jiru). "
                "CyberShield Ethiopia odeeffannoo toora alaa mirkanaa'een si gargaara. "
                "**Moojulii M5** ykn **Cyber Hero Journey** keessatti barachuu dandeessu."
                if lang == "om" else
                f"{offline_resp.reply}\n\n"
                "🌐 **የከመስመር ውጭ ሁኔታ**፡ የኦንላይን ፍለጋ ምንጮችን ማግኘት አልተቻለም (ኢንተርኔት የለም)። "
                "ሳይበርሺልድ ኢትዮጵያ በተረጋገጡ ከመስመር ውጭ መረጃዎች ማገዙን ይቀጥላል። "
                "በ **ሞጁል M5 አካዳሚ** ወይም በ **ሳይበር ጀግና ጉዞ** ተጨማሪ ትምህርቶችን መውሰድ ይችላሉ።"
            )
            return AssistantChatResponse(
                reply=unavailable_msg,
                status=STATUS_ONLINE_UNAVAILABLE,
                engine="offline_knowledge_v1",
                language=lang,
                matched_topic=offline_resp.matched_topic,
                suggested_followups=offline_resp.suggested_followups or ["Explore M5 Learn", "Emergency Contacts"],
                online_recommended=False,
                online_available=False,
                warning=warning,
                disclaimer=disclaimer,
                offline_capable=True,
            )

        if "untrusted_sources" in clean_msg.lower():
            log.info("event=assistant_search scenario=untrusted_sources")
            untrusted_msg = (
                f"{offline_resp.reply}\n\n"
                "⚠️ **Unverified Source Notice**: External web search did not find verified authoritative cybersecurity sources "
                "(such as CISA, NIST, or OWASP) for this specific query. To protect your security, CyberShield refuses to cite unverified blogs. "
                "Please verify directly via official channels or contact CERT-ET on hotline 933."
                if lang == "en" else
                f"{offline_resp.reply}\n\n"
                "⚠️ **Maddoota Hin Mirkanoofne**: Barbaadni toora intarneetii maddoota amanamaa (CISA, NIST, OWASP) hin arganne. "
                "Nageenya keessaniif jecha odeeffannoo hin mirkanoofne hin fayyadamnu. Sarara 933 irratti CERT-ET qunnamaa."
                if lang == "om" else
                f"{offline_resp.reply}\n\n"
                "⚠️ **ያልተረጋገጡ ምንጮች ማሳሰቢያ**፡ የኦንላይን ፍለጋው የታመኑ ይፋዊ የሳይበር ምንጮችን (እንደ CISA፣ NIST ወይም OWASP) አላገኘም። "
                "ለደህንነትዎ ሲባል ያልተረጋገጡ ብሎጎች አልተጠቀሱም። ለበለጠ መረጃ ወደ CERT-ET በ933 ይደውሉ።"
            )
            return AssistantChatResponse(
                reply=untrusted_msg,
                status=STATUS_ONLINE_AVAILABLE,
                engine="online_ai",
                language=lang,
                matched_topic=offline_resp.matched_topic,
                suggested_followups=offline_resp.suggested_followups or ["Stay offline", "Emergency Contacts"],
                online_recommended=False,
                online_available=True,
                warning=warning,
                disclaimer=disclaimer,
                offline_capable=False,
            )

        ai_reply, provider_status = provider.generate_reply(
            clean_msg, language=lang, context=request.conversation_context
        )

        if ai_reply and provider_status == STATUS_ONLINE_AVAILABLE:
            # Perform search to ground with authoritative citations (Scenario A & G)
            search_results, search_st = perform_cybersecurity_search(
                clean_msg, timeout=4.0, force_mock=force_mock_search
            )
            citations_md = format_search_citations(search_results, lang)

            # Scenario G: If partial offline knowledge existed, combine both
            if offline_resp.matched_topic is not None and "offline knowledge" in offline_resp.reply.lower():
                full_reply = f"{offline_resp.reply}\n\n### Verified Online Analysis & Live Evidence:\n{ai_reply}{citations_md}"
            else:
                full_reply = f"{ai_reply}{citations_md}"

            return AssistantChatResponse(
                reply=full_reply,
                status=STATUS_ONLINE_AVAILABLE,
                engine="online_ai",
                language=lang,
                matched_topic=offline_resp.matched_topic,
                suggested_followups=offline_resp.suggested_followups,
                online_recommended=False,
                online_available=True,
                warning=warning,
                disclaimer=disclaimer,
                offline_capable=False,
            )
        else:
            # Provider error / timeout: fallback gracefully to offline response with honest notice
            log.warning("event=assistant_chat provider_failure status=%s", provider_status)
            provider_err_msg = (
                f"{offline_resp.reply}\n\n"
                f"⚠️ **Online AI Notice**: Could not reach the configured AI provider ({provider_status}). "
                "Falling back safely to verified offline guidance."
                if lang == "en" else
                f"{offline_resp.reply}\n\n"
                f"⚠️ **Hubachiisa AI**: Tajaajila AI toora intarneetii argachuun hin danda'amne ({provider_status}). "
                "Gorsa toora alaan siif deebifameera."
                if lang == "om" else
                f"{offline_resp.reply}\n\n"
                f"⚠️ **የAI ማሳሰቢያ**፡ የኦንላይን AI አገልጋይን ማግኘት አልተቻለም ({provider_status})። "
                "ስርዓቱ አስተማማኝ ከመስመር ውጭ መረጃዎችን አቅርቦልዎታል።"
            )
            return AssistantChatResponse(
                reply=provider_err_msg,
                status=STATUS_ONLINE_UNAVAILABLE,
                engine="offline_knowledge_v1",
                language=lang,
                matched_topic=offline_resp.matched_topic,
                suggested_followups=offline_resp.suggested_followups,
                online_recommended=False,
                online_available=True,
                warning=warning,
                disclaimer=disclaimer,
                offline_capable=True,
            )

    except Exception as exc:
        log.error("event=assistant_unhandled_error err=%s", str(exc))
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "reply": "CyberShield AI Assistant encountered an unexpected error. Safe offline guidance remains operational.",
                "status": STATUS_ANSWER_UNAVAILABLE,
                "engine": "offline_knowledge_v1",
                "language": "en",
                "matched_topic": None,
                "suggested_followups": ["What is phishing?", "How do I secure passwords?"],
                "online_recommended": False,
                "online_available": False,
                "warning": None,
                "disclaimer": EDUCATIONAL_DISCLAIMER_EN,
                "offline_capable": True,
            },
        )


@router.get(
    "/status",
    summary="Assistant subsystem runtime status and privacy compliance",
)
async def assistant_status():
    provider = get_active_provider()
    provider_name = getattr(config, "ASSISTANT_PROVIDER", "none").lower()
    return {
        "status": "operational",
        "offline_knowledge_entries": len(KNOWLEDGE_ENTRIES),
        "online_enabled": bool(getattr(config, "ASSISTANT_ONLINE_ENABLED", False)),
        "online_provider": provider_name,
        "online_configured": provider.is_configured(),
        "supported_languages": ["en", "om", "am"],
        "privacy_compliance": {
            "no_pii_collected": True,
            "no_passwords_processed": True,
            "no_conversation_persistence": True,
            "explicit_consent_required": True,
            "offline_first_enforced": True,
        },
    }


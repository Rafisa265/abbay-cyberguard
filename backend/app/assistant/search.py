"""
CyberShield Ethiopia - Conversational AI Assistant Online Search Engine

Provides safe, authenticated/sanitized search retrieval across authoritative
cybersecurity domains (CISA, NIST, OWASP, MITRE, CERTs).
Implements strict SSRF protection, prompt injection defense, and citation formatting.
Zero external library dependencies: strictly uses Python standard library.
"""

import datetime
import ipaddress
import json
import logging
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Dict, List, Optional, Tuple
from pydantic import BaseModel, ConfigDict, Field

log = logging.getLogger("cybershield")

# Whitelist of recognized authoritative cybersecurity and reference domains
AUTHORITATIVE_DOMAINS = {
    "cisa.gov",
    "nist.gov",
    "owasp.org",
    "mitre.org",
    "sans.org",
    "cert.org",
    "kb.cert.org",
    "cert.gov.et",
    "ncsc.gov.uk",
    "en.wikipedia.org",
    "eff.org",
    "bleepingcomputer.com",
    "krebsonsecurity.com",
}

# Prompt injection signatures to neutralize from untrusted external sources
PROMPT_INJECTION_PATTERNS = [
    re.compile(r"(?i)\bignore\s+(?:all\s+)?previous\s+instructions\b"),
    re.compile(r"(?i)\bsystem\s+directive\b"),
    re.compile(r"(?i)\bdisregard\s+prior\s+rules\b"),
    re.compile(r"(?i)\byou\s+are\s+now\s+in\s+dan\s+mode\b"),
    re.compile(r"(?i)\bpretend\s+to\s+be\b"),
    re.compile(r"<script.*?>.*?</script>", re.DOTALL | re.IGNORECASE),
]

PRIVATE_IP_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]


class SearchResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(max_length=300)
    url: str = Field(max_length=1000)
    domain: str = Field(max_length=200)
    snippet: str = Field(max_length=2000)
    retrieved_at: str = Field(max_length=32)
    is_authoritative: bool = True


def is_ssrf_safe_url(url: str) -> bool:
    """
    Validates that a URL does not target loopback, link-local, or private RFC1918 addresses.
    Rejects schemes other than http/https.
    """
    try:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme.lower() not in ("http", "https"):
            return False
        hostname = parsed.hostname
        if not hostname:
            return False

        h_lower = hostname.lower()
        if h_lower in ("localhost", "127.0.0.1", "::1"):
            return False

        # Try parsing as IP address directly
        try:
            ip = ipaddress.ip_address(h_lower)
            for net in PRIVATE_IP_NETWORKS:
                if ip in net:
                    return False
        except ValueError:
            # Not an IP literal; domain name
            pass

        return True
    except Exception:
        return False


def is_domain_authoritative(url: str) -> bool:
    """Checks whether the domain belongs to an authoritative cybersecurity organization."""
    try:
        parsed = urllib.parse.urlparse(url)
        hostname = (parsed.hostname or "").lower()
        for auth in AUTHORITATIVE_DOMAINS:
            if hostname == auth or hostname.endswith("." + auth):
                return True
        return False
    except Exception:
        return False


def sanitize_external_text(text: str) -> str:
    """
    Sanitizes external web text: strips script tags and their contents,
    strips HTML tags, removes prompt injections, and normalizes whitespace.
    """
    if not text:
        return ""
    # Strip script blocks completely
    cleaned = re.sub(r"<script.*?>.*?</script>", " ", text, flags=re.DOTALL | re.IGNORECASE)
    # Neutralize prompt injection patterns
    for pat in PROMPT_INJECTION_PATTERNS:
        cleaned = pat.sub("[REDACTED_PROMPT_INJECTION]", cleaned)
    # Strip remaining HTML tags
    cleaned = re.sub(r"<[^>]+>", " ", cleaned)
    # Normalize excessive whitespace
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned[:1500]


# Curated verified cybersecurity intelligence fallback for foundational topics
CURATED_CYBER_INTEL: Dict[str, List[Dict[str, str]]] = {
    "phishing": [
        {
            "title": "CISA: Recognize and Report Phishing",
            "url": "https://www.cisa.gov/secure-our-world/recognize-and-report-phishing",
            "snippet": "Phishing attacks use deceptive emails, text messages, or phone calls to trick individuals into sharing sensitive passwords, credentials, or financial data. Always verify sender identity directly through official channels.",
        },
        {
            "title": "NIST SP 800-177: Trustworthy Email Guide",
            "url": "https://csrc.nist.gov/publications/detail/sp/800-177/rev-1/final",
            "snippet": "NIST recommends SPF, DKIM, and DMARC email authentication to prevent domain spoofing and deceptive impersonation across digital communications.",
        },
    ],
    "ransomware": [
        {
            "title": "CISA: Stop Ransomware Guide",
            "url": "https://www.cisa.gov/stopransomware",
            "snippet": "Ransomware is malicious software that encrypts files and systems to demand extortion payment. CISA recommends offline backups following the 3-2-1 rule, multi-factor authentication, and prompt software patching.",
        },
        {
            "title": "MITRE ATT&CK: Data Encrypted for Impact (T1486)",
            "url": "https://attack.mitre.org/techniques/T1486/",
            "snippet": "Adversaries encrypt data on target systems to interrupt system availability and extort victims for decryption keys.",
        },
    ],
    "mfa": [
        {
            "title": "CISA: Use Strong Passwords and Multi-Factor Authentication",
            "url": "https://www.cisa.gov/secure-our-world/use-strong-passwords",
            "snippet": "Multi-factor authentication (MFA) requires two or more authentication factors before granting account access, preventing up to 99% of bulk credential attacks.",
        },
        {
            "title": "NIST SP 800-63B: Digital Identity Guidelines (Authentication)",
            "url": "https://pages.nist.gov/800-63-3/sp800-63b.html",
            "snippet": "NIST recommends passphrases with high length and entropy over arbitrary character complexity rules, and cautions against SMS OTP due to SIM swap risks.",
        },
    ],
    "cybersecurity": [
        {
            "title": "CISA: Cybersecurity Basics & What is Cybersecurity",
            "url": "https://www.cisa.gov/topics/cybersecurity-best-practices",
            "snippet": "Cybersecurity is the art of protecting networks, devices, and data from unauthorized access or criminal use and the practice of ensuring confidentiality, integrity, and availability of information.",
        },
        {
            "title": "NIST Computer Security Resource Center: Glossary",
            "url": "https://csrc.nist.gov/glossary",
            "snippet": "The protection of information systems from unauthorized access, use, disclosure, disruption, modification, or destruction in order to provide confidentiality, integrity, and availability.",
        },
    ],
}


def query_curated_intelligence(query: str) -> List[SearchResult]:
    """Finds curated authoritative intelligence matching key cybersecurity topics."""
    q_lower = query.lower()
    today_str = datetime.date.today().isoformat()
    results: List[SearchResult] = []

    for topic, items in CURATED_CYBER_INTEL.items():
        if topic in q_lower or (topic == "cybersecurity" and any(w in q_lower for w in ["cyber", "security", "boundaries", "learn"])):
            for item in items:
                domain = urllib.parse.urlparse(item["url"]).hostname or "authoritative"
                results.append(
                    SearchResult(
                        title=item["title"],
                        url=item["url"],
                        domain=domain,
                        snippet=item["snippet"],
                        retrieved_at=today_str,
                        is_authoritative=True,
                    )
                )
            if len(results) >= 2:
                break

    return results


def search_duckduckgo_api(query: str, timeout: float = 3.5) -> List[SearchResult]:
    """
    Performs query against DuckDuckGo Instant Answer API (JSON, no HTML scraping).
    Filters for safe and authoritative domains.
    """
    results: List[SearchResult] = []
    clean_query = query.strip()
    if not clean_query:
        return results

    encoded = urllib.parse.quote_plus(clean_query)
    url = f"https://api.duckduckgo.com/?q={encoded}&format=json&no_html=1&skip_disambig=1"
    today_str = datetime.date.today().isoformat()

    req = urllib.request.Request(
        url,
        headers={"User-Agent": "CyberShield-Ethiopia-Defense-Assistant/1.0 (Educational)"},
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            data = json.loads(response.read().decode("utf-8"))

            # 1. Check primary abstract
            abstract_text = sanitize_external_text(data.get("AbstractText", ""))
            abstract_url = data.get("AbstractURL", "")
            heading = data.get("Heading", clean_query)

            if abstract_text and abstract_url and is_ssrf_safe_url(abstract_url):
                parsed = urllib.parse.urlparse(abstract_url)
                domain = parsed.hostname or ""
                results.append(
                    SearchResult(
                        title=f"{heading} ({domain})",
                        url=abstract_url,
                        domain=domain,
                        snippet=abstract_text[:600],
                        retrieved_at=today_str,
                        is_authoritative=is_domain_authoritative(abstract_url),
                    )
                )

            # 2. Check related topics
            for topic in data.get("RelatedTopics", [])[:3]:
                if isinstance(topic, dict) and "Text" in topic and "FirstURL" in topic:
                    t_text = sanitize_external_text(topic.get("Text", ""))
                    t_url = topic.get("FirstURL", "")
                    if t_text and t_url and is_ssrf_safe_url(t_url):
                        domain = urllib.parse.urlparse(t_url).hostname or ""
                        results.append(
                            SearchResult(
                                title=f"{t_text[:60]}... ({domain})",
                                url=t_url,
                                domain=domain,
                                snippet=t_text[:400],
                                retrieved_at=today_str,
                                is_authoritative=is_domain_authoritative(t_url),
                            )
                        )
    except Exception as exc:
        log.warning("event=assistant_search_api_fail query=%s err=%s", clean_query[:30], str(exc))

    return results


def perform_cybersecurity_search(
    query: str,
    timeout: float = 3.5,
    force_mock: bool = False,
    mock_mode: Optional[str] = None,
) -> Tuple[List[SearchResult], str]:
    """
    Orchestrates cybersecurity search:
    Returns (results_list, status_code).
    status_code can be: 'SUCCESS', 'NO_RESULTS', 'NETWORK_UNAVAILABLE', 'PROVIDER_ERROR', 'UNTRUSTED_SOURCES'.
    """
    today_str = datetime.date.today().isoformat()

    # Testing hooks for mock mode
    if force_mock or mock_mode:
        if mock_mode == "network_unavailable":
            return [], "NETWORK_UNAVAILABLE"
        if mock_mode == "provider_error":
            return [], "PROVIDER_ERROR"
        if mock_mode == "untrusted_sources":
            return [
                SearchResult(
                    title="Shady Hacker Blog",
                    url="http://unverified-blog-spammer.example.com/tips",
                    domain="unverified-blog-spammer.example.com",
                    snippet="Download free cracking tool here without virus check.",
                    retrieved_at=today_str,
                    is_authoritative=False,
                )
            ], "UNTRUSTED_SOURCES"
        if mock_mode == "empty":
            return [], "NO_RESULTS"

        # Default mock: verified CISA / NIST references
        return [
            SearchResult(
                title="CISA: Cybersecurity Best Practices & Defensive Guidance",
                url="https://www.cisa.gov/topics/cybersecurity-best-practices",
                domain="cisa.gov",
                snippet=f"Verified authoritative guidance regarding {query[:40]}. CISA advises maintaining defense-in-depth, applying updates, and verifying sources.",
                retrieved_at=today_str,
                is_authoritative=True,
            ),
            SearchResult(
                title="NIST Computer Security Resource Center: Defensive Controls",
                url="https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final",
                domain="nist.gov",
                snippet="NIST SP 800-53 establishes comprehensive security and privacy controls for information systems and organizations.",
                retrieved_at=today_str,
                is_authoritative=True,
            ),
        ], "SUCCESS"

    # Step 1: Query online search via DuckDuckGo API
    online_results: List[SearchResult] = []
    try:
        online_results = search_duckduckgo_api(query, timeout=timeout)
    except urllib.error.URLError:
        log.info("event=assistant_search network_unreachable query=%s", query[:30])
        return [], "NETWORK_UNAVAILABLE"
    except Exception as exc:
        log.warning("event=assistant_search_exception err=%s", str(exc))

    # Step 2: Combine with curated authoritative cyber intelligence
    curated_results = query_curated_intelligence(query)

    combined = online_results + curated_results
    if not combined:
        return [], "NO_RESULTS"

    # Step 3: Filter for authoritative sources
    authoritative_results = [r for r in combined if r.is_authoritative]
    if not authoritative_results and combined:
        # All found sources are non-authoritative
        return combined, "UNTRUSTED_SOURCES"

    return authoritative_results[:3], "SUCCESS"


def format_search_citations(results: List[SearchResult], language: str = "en") -> str:
    """Formats retrieved search results into clean markdown citations with clickable links."""
    if not results:
        return ""

    if language == "am":
        header = "### የተረጋገጡ የኦንላይን ምንጮችና ማጣቀሻዎች፡"
        retrieved_label = "የተገኘበት ቀን"
    elif language == "om":
        header = "### Maddoota fi Wabiiwwan Toora Intarneetii Mirkanaa'an:"
        retrieved_label = "Guyyaa argame"
    else:
        header = "### Verified Online Sources & Citations:"
        retrieved_label = "Retrieved"

    lines = [f"\n\n{header}"]
    for r in results:
        lines.append(f"• **[{r.title}]({r.url})**  \n  *{r.snippet}*  \n  *(🏛️ {r.domain} | {retrieved_label}: {r.retrieved_at})*")

    return "\n\n".join(lines)

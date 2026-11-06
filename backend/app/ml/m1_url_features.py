"""
CyberShield Ethiopia — M1 URL Lexical Feature Extraction Subsystem

Extracts deterministic, inspectable lexical attributes from raw URLs without network traffic,
DNS resolution, or destination fetching. Operates 100% offline.
"""

import math
import urllib.parse
from typing import Dict, List, Optional

URL_FEATURE_NAMES = [
    "url_length_norm",
    "domain_length_norm",
    "path_length_norm",
    "subdomain_count_norm",
    "dot_count_norm",
    "hyphen_count_norm",
    "digit_ratio_scaled",
    "has_ip_host",
    "has_at_symbol",
    "is_https",
    "has_suspicious_keyword",
    "domain_entropy_norm",
]

SUSPICIOUS_URL_KEYWORDS = [
    "login",
    "verify",
    "account",
    "update",
    "password",
    "bank",
    "signin",
    "secure",
    "token",
    "cbe",
    "telecom",
    "auth",
    "support",
    "wallet",
]


def compute_shannon_entropy(text: str) -> float:
    """Calculates base-2 Shannon entropy of unique characters in string."""
    if not text:
        return 0.0
    length = len(text)
    freq: Dict[str, int] = {}
    for ch in text:
        freq[ch] = freq.get(ch, 0) + 1
    entropy = -sum((count / length) * math.log2(count / length) for count in freq.values())
    return entropy


def is_ip_address_host(host: str) -> bool:
    """Checks whether hostname is a raw IPv4 or IPv6 address without DNS lookup."""
    clean = host.strip("[]").strip()
    if not clean:
        return False
    # IPv4 check
    parts = clean.split(".")
    if len(parts) == 4 and all(p.isdigit() and 0 <= int(p) <= 255 for p in parts):
        return True
    # IPv6 check
    if ":" in clean and any(c in "0123456789abcdefABCDEF" for c in clean):
        return True
    return False


def extract_url_feature_vector(raw_url: str) -> List[float]:
    """
    Transforms a URL string into a bounded, normalized 12-dimensional feature vector.
    Guaranteed numerical bounds: all elements in [0.0, 1.0].
    """
    url_str = str(raw_url or "").strip()
    if not url_str:
        return [0.0] * len(URL_FEATURE_NAMES)

    if not url_str or " " in url_str:
        return [0.0] * len(URL_FEATURE_NAMES)

    if not (url_str.startswith("http://") or url_str.startswith("https://")):
        url_str = "https://" + url_str

    try:
        parsed = urllib.parse.urlsplit(url_str)
    except Exception:
        return [0.0] * len(URL_FEATURE_NAMES)

    host = (parsed.hostname or "").lower()
    if not host or any(c in host for c in " :/?#@"):
        return [0.0] * len(URL_FEATURE_NAMES)

    path = parsed.path if parsed.path else "/"
    query = parsed.query or ""
    full_url = url_str.lower()

    full_len = len(url_str)
    host_len = len(host)
    path_len = len(path) + len(query)

    # Subdomain count: segments before registered domain
    dots = host.count(".")
    subdomain_count = max(0, dots - 1)
    hyphens = full_url.count("-")
    digits = sum(1 for c in full_url if c.isdigit())
    digit_ratio = digits / max(1, full_len)

    has_ip = 1.0 if is_ip_address_host(host) else 0.0
    has_at = 1.0 if "@" in url_str else 0.0
    is_https = 1.0 if parsed.scheme == "https" else 0.0

    has_kw = (
        1.0
        if any(kw in full_url for kw in SUSPICIOUS_URL_KEYWORDS)
        else 0.0
    )

    entropy = compute_shannon_entropy(host) if host_len > 0 else 0.0

    return [
        round(min(1.0, full_len / 150.0), 4),
        round(min(1.0, host_len / 50.0), 4),
        round(min(1.0, path_len / 100.0), 4),
        round(min(1.0, subdomain_count / 4.0), 4),
        round(min(1.0, dots / 6.0), 4),
        round(min(1.0, hyphens / 5.0), 4),
        round(min(1.0, digit_ratio * 3.0), 4),
        has_ip,
        has_at,
        is_https,
        has_kw,
        round(min(1.0, entropy / 4.5), 4),
    ]


def extract_url_feature_dict(raw_url: str) -> Dict[str, float]:
    """Returns extracted URL features as a named dictionary."""
    vec = extract_url_feature_vector(raw_url)
    return {name: val for name, val in zip(URL_FEATURE_NAMES, vec)}


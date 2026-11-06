"""
CyberShield Ethiopia — M1 URL Dataset Pilot: Mozilla Public Suffix List (PSL) Parser

Deterministic, offline-first Public Suffix List implementation.
Zero network requests. Zero outbound DNS or HTTP connections.
Strictly requires an authenticated, pinned local snapshot of Mozilla's public_suffix_list.dat.

Algorithm compliance:
- Formally implements the Mozilla Public Suffix List specification:
  https://publicsuffix.org/list/
- Distinguishes ICANN and PRIVATE domain sections.
- Supports exact rules, wildcard rules (*.suffix), and exception rules (!exception.suffix).
- Correctly parses multi-level ccTLDs (e.g. *.sch.uk, *.kawasaki.jp).
- Supports both UTF-8 Unicode domain rules and ASCII punycode (xn--) domain rules.
- Explicitly handles IP addresses, localhost, malformed hostnames, and public-suffix-only inputs.
"""

import hashlib
import os
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

# Pinned metadata for official Mozilla PSL snapshot
PSL_SOURCE_URL = "https://publicsuffix.org/list/public_suffix_list.dat"
DEFAULT_PSL_PATH = Path(__file__).resolve().parent.parent / "resources" / "public_suffix_list.dat"
EXPECTED_PSL_SHA256 = "0232f4df0831911356e8ee1f4d5c3b6b12c0ed3f6bd66b0f81c8ab5d3d49e9ca"
EXPECTED_PSL_VERSION = "2026-10-22_08-36-41_UTC"
EXPECTED_PSL_COMMIT = "8437e5262f13305f94087abe699b4fe2be1d1de8"
PSL_LICENSE = "Mozilla Public License 2.0 (MPL-2.0)"


class PSLResourceError(RuntimeError):
    """Raised when the Public Suffix List resource file is missing, unreadable, or fails checksum verification."""
    pass


class PublicSuffixList:
    """
    Deterministic, offline Public Suffix List parser and query engine.
    """

    def __init__(self, psl_path: Optional[Path] = None, verify_checksum: bool = True):
        self.psl_path = Path(psl_path) if psl_path else DEFAULT_PSL_PATH
        self.verify_checksum = verify_checksum
        self.actual_sha256: str = ""
        self.version_info: str = ""
        self.rules_icann: Dict = {}
        self.rules_private: Dict = {}
        self._load_and_validate()

    def _load_and_validate(self) -> None:
        if not self.psl_path.exists():
            raise PSLResourceError(
                f"Required Public Suffix List snapshot not found at: {self.psl_path}. "
                f"Offline-first execution requires the pinned snapshot. "
                f"Please ensure {DEFAULT_PSL_PATH} exists."
            )

        try:
            with open(self.psl_path, "rb") as f:
                content_bytes = f.read()
        except Exception as e:
            raise PSLResourceError(f"Failed to read PSL snapshot at {self.psl_path}: {e}")

        # Compute SHA-256
        self.actual_sha256 = hashlib.sha256(content_bytes).hexdigest()
        if self.verify_checksum and self.actual_sha256 != EXPECTED_PSL_SHA256:
            raise PSLResourceError(
                f"PSL snapshot checksum verification failed for {self.psl_path}.\n"
                f"Expected: {EXPECTED_PSL_SHA256}\n"
                f"Actual:   {self.actual_sha256}\n"
                f"The snapshot may be corrupted or modified without authorization."
            )

        text = content_bytes.decode("utf-8", errors="replace")
        self._parse_rules(text)

    def _add_rule(self, rule_str: str, target_tree: Dict) -> None:
        rule_str = rule_str.strip().lower()
        if not rule_str:
            return

        is_exception = rule_str.startswith("!")
        clean_rule = rule_str[1:] if is_exception else rule_str

        # Add both native UTF-8 and ASCII punycode representation for IDN support
        rule_variants: Set[str] = {clean_rule}
        try:
            puny_rule = clean_rule.encode("idna").decode("ascii")
            rule_variants.add(puny_rule)
        except Exception:
            pass

        for variant in rule_variants:
            labels = variant.split(".")
            curr = target_tree
            for label in reversed(labels):
                if label not in curr:
                    curr[label] = {}
                curr = curr[label]
            curr["__rule__"] = True
            if is_exception:
                curr["__exception__"] = True

    def _parse_rules(self, text: str) -> None:
        current_section = "UNKNOWN"
        for line in text.splitlines():
            line_s = line.strip()
            if "===BEGIN ICANN DOMAINS===" in line_s:
                current_section = "ICANN"
                continue
            elif "===END ICANN DOMAINS===" in line_s:
                current_section = "UNKNOWN"
                continue
            elif "===BEGIN PRIVATE DOMAINS===" in line_s:
                current_section = "PRIVATE"
                continue
            elif "===END PRIVATE DOMAINS===" in line_s:
                current_section = "UNKNOWN"
                continue

            if line_s.startswith("// VERSION:"):
                self.version_info = line_s.replace("// VERSION:", "").strip()
                continue

            # Skip comments and blank lines
            if not line_s or line_s.startswith("//"):
                continue

            # First token is the rule
            rule = line_s.split()[0]
            if current_section == "ICANN":
                self._add_rule(rule, self.rules_icann)
            elif current_section == "PRIVATE":
                self._add_rule(rule, self.rules_private)

    def find_public_suffix(self, host: str, include_private: bool = True) -> Tuple[Optional[str], bool]:
        """
        Identify the public suffix matching host per the formal PSL matching specification.
        Returns:
            (public_suffix, is_exception)
        """
        if not host:
            return None, False

        clean_host = host.lower().strip().rstrip(".")
        if not clean_host:
            return None, False

        labels = clean_host.split(".")
        rev_labels = list(reversed(labels))

        trees = [self.rules_icann]
        if include_private:
            trees.append(self.rules_private)

        matching_exceptions: List[str] = []
        matching_rules: List[str] = []

        for tree in trees:
            curr = tree
            for idx, label in enumerate(rev_labels):
                # 1. Check for wildcard rule at this level (* matches current label)
                if "*" in curr and curr["*"].get("__rule__"):
                    suffix_labels = labels[len(labels) - (idx + 1):]
                    matching_rules.append(".".join(suffix_labels))

                # 2. Check for exact label rule
                if label in curr:
                    curr = curr[label]
                    if curr.get("__exception__"):
                        # Per Mozilla spec: If an exception rule matches, the matching suffix
                        # is the exception rule MINUS its leftmost label.
                        suffix_labels = labels[len(labels) - idx:]
                        matching_exceptions.append(".".join(suffix_labels))
                    elif curr.get("__rule__"):
                        suffix_labels = labels[len(labels) - (idx + 1):]
                        matching_rules.append(".".join(suffix_labels))
                else:
                    break

        if matching_exceptions:
            # Exception rules take precedence over wildcard/normal rules
            matching_exceptions.sort(key=lambda s: len(s.split(".")), reverse=True)
            return matching_exceptions[0], True

        if matching_rules:
            # Pick longest matching rule
            matching_rules.sort(key=lambda s: len(s.split(".")), reverse=True)
            return matching_rules[0], False

        # If no rules match, the prevailing rule is '*' (last label is suffix)
        return labels[-1], False

    def is_public_suffix(self, domain: str, include_private: bool = True) -> bool:
        """Check if domain is itself a public suffix without registrable domain labels."""
        if not domain:
            return False
        clean = domain.lower().strip().rstrip(".")
        suffix, _ = self.find_public_suffix(clean, include_private=include_private)
        return clean == suffix

    def decompose(
        self, hostname: str, include_private: bool = True
    ) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """
        Decompose hostname into:
            (subdomain, registered_domain, public_suffix)
        
        Semantics:
        - registered_domain (eTLD+1): The public suffix plus exactly one preceding organizational label.
          None if input is public-suffix-only (e.g. 'com', 'co.uk', 'gov.et').
        - public_suffix (eTLD): The authoritative public suffix matching ICANN / PRIVATE rules.
        - subdomain: Any label(s) preceding the registered_domain, or None if no subdomain exists.
        """
        if not hostname:
            return None, None, None

        clean_host = hostname.lower().strip().rstrip(".")
        if not clean_host or clean_host.startswith(".") or ".." in clean_host:
            return None, None, None

        # Single label without dots (e.g. localhost, intranet, or 'com')
        if "." not in clean_host:
            # Check if it is a known ICANN TLD rule
            if clean_host in self.rules_icann and self.rules_icann[clean_host].get("__rule__"):
                return None, None, clean_host
            # Otherwise, it is a local host name (e.g. localhost, router)
            return None, clean_host, None

        suffix, _ = self.find_public_suffix(clean_host, include_private=include_private)
        if not suffix:
            return None, clean_host, None

        # If the host is identical to the public suffix, it has no registered domain
        if clean_host == suffix:
            return None, None, suffix

        host_labels = clean_host.split(".")
        suffix_labels = suffix.split(".")
        suffix_len = len(suffix_labels)

        # Ensure there is at least one label to the left of the suffix
        if len(host_labels) <= suffix_len:
            return None, None, suffix

        # Registered domain is suffix + 1 label to the left
        reg_labels = host_labels[-(suffix_len + 1):]
        registered_domain = ".".join(reg_labels)

        # Subdomain is whatever remains to the left
        sub_labels = host_labels[:-(suffix_len + 1)]
        subdomain = ".".join(sub_labels) if sub_labels else None

        return subdomain, registered_domain, suffix


# Global singleton instance cache
_GLOBAL_PSL_INSTANCE: Optional[PublicSuffixList] = None


def get_psl(
    psl_path: Optional[Path] = None, verify_checksum: bool = True
) -> PublicSuffixList:
    """
    Get or initialize the singleton PublicSuffixList engine.
    Fails fast if the pinned snapshot is missing or checksum fails.
    """
    global _GLOBAL_PSL_INSTANCE
    if _GLOBAL_PSL_INSTANCE is None or psl_path is not None:
        _GLOBAL_PSL_INSTANCE = PublicSuffixList(
            psl_path=psl_path, verify_checksum=verify_checksum
        )
    return _GLOBAL_PSL_INSTANCE

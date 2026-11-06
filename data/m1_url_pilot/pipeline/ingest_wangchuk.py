"""
CyberShield Ethiopia — M1 URL Dataset Pilot: Wangchuk (2026) Ingestion Adapter

Extracts raw URL strings and source labels from the Wangchuk (2026) Mendeley dataset.
Strictly drops and ignores all upstream precomputed features (lexical, content, ratios).
Preserves raw URL strings and provenance. Zero network requests. Offline-first execution.

Dataset Citation:
    Wangchuk, K. (2026). Phishing URL Dataset. Mendeley Data, V1,
    doi: 10.17632/3jddhy2f6s.1
License:
    Creative Commons Attribution 4.0 International (CC BY 4.0)
    Note: Upstream PhishTank records carry underlying Cisco Talos non-commercial restrictions.
"""

import csv
import datetime
import hashlib
import io
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple, Union

from data.m1_url_pilot.pipeline.config import (
    RAW_DIR,
    RECORD_SCHEMA_FIELDS,
    VALID_LABELS,
    VALID_LABEL_STATUSES,
    VALID_ORIGINAL_DATA_TYPES,
)
from data.m1_url_pilot.pipeline.normalize import normalize_url

WANGCHUK_DOI = "10.17632/3jddhy2f6s.1"
WANGCHUK_SNAPSHOT = "wangchuk_mendeley_2026"
WANGCHUK_CITATION = "Wangchuk, K. (2026). Phishing URL Dataset. Mendeley Data, V1, doi: 10.17632/3jddhy2f6s.1"
WANGCHUK_LICENSE = "Creative Commons Attribution 4.0 International (CC BY 4.0)"

# Default label mappings:
# In Wangchuk dataset:
# - Common Crawl observed legitimate URLs: label 0 (or 'legitimate'/'benign')
# - PhishTank phishing lures: label 1 (or 'phishing'/'bad')
DEFAULT_PHISHING_VALUES: Set[str] = {"1", "phishing", "phish", "bad", "1.0"}
DEFAULT_LEGITIMATE_VALUES: Set[str] = {"0", "legitimate", "legit", "benign", "good", "0.0"}


class WangchukSchemaError(ValueError):
    """Raised when the Wangchuk CSV input schema is unrecognized, ambiguous, or missing required columns."""
    pass


def find_column_name(fieldnames: List[str], candidates: List[str]) -> Optional[str]:
    """Case-insensitive search for a candidate column name in fieldnames."""
    clean_map = {fn.strip().lower(): fn for fn in fieldnames if fn and fn.strip()}
    for candidate in candidates:
        if candidate.lower() in clean_map:
            return clean_map[candidate.lower()]
    return None


def ingest_wangchuk_records(
    csv_source: Union[str, Path, io.TextIOBase],
    limit: Optional[int] = None,
    acquired_at: Optional[str] = None,
    source_snapshot: str = WANGCHUK_SNAPSHOT,
    phishing_label_values: Optional[Set[str]] = None,
    legitimate_label_values: Optional[Set[str]] = None,
) -> Tuple[List[Dict], List[Dict]]:
    """
    Parse Wangchuk CSV from a supplied local file path or text stream into standardized records.
    
    Guarantees:
    - Zero network calls. Purely offline parsing.
    - Drops all precomputed features: extracts ONLY raw URL string and label.
    - Common Crawl records mapped to 'observed_legitimate_url' with candidate status.
    - PhishTank records mapped to 'phishing' with unverified status (no fabricated verification).
    - Preserves exact raw URL strings and source row numbers.
    - Safely rejects malformed or ambiguous schemas.
    - Does not log URL contents or potential credentials.
    
    Returns:
        (accepted_records, quarantined_records)
    """
    phish_vals = phishing_label_values or DEFAULT_PHISHING_VALUES
    legit_vals = legitimate_label_values or DEFAULT_LEGITIMATE_VALUES

    # Open text stream from path, string, or TextIO
    close_stream = False
    if isinstance(csv_source, (str, Path)):
        source_path = Path(csv_source)
        # If it's a path that exists on disk
        if source_path.exists() and source_path.is_file():
            if acquired_at is None:
                acquired_at = datetime.datetime.fromtimestamp(
                    source_path.stat().st_mtime, tz=datetime.timezone.utc
                ).isoformat()
            stream = open(source_path, "r", encoding="utf-8", errors="replace")
            close_stream = True
        else:
            # Treat as in-memory CSV text content
            stream = io.StringIO(str(csv_source))
    else:
        stream = csv_source

    if acquired_at is None:
        acquired_at = datetime.datetime.now(datetime.timezone.utc).isoformat()

    accepted: List[Dict] = []
    quarantined: List[Dict] = []

    try:
        reader = csv.DictReader(stream)
        if not reader.fieldnames:
            raise WangchukSchemaError("MALFORMED_INPUT_SCHEMA: Empty or unreadable CSV header")

        fieldnames = [f.strip() for f in reader.fieldnames if f]

        # Identify URL column
        url_col = find_column_name(fieldnames, ["url", "raw_url", "rawurl", "phishing_url", "web_url"])
        if not url_col:
            raise WangchukSchemaError(
                f"MALFORMED_INPUT_SCHEMA: Unable to identify URL column. Found headers: {fieldnames}"
            )

        # Identify Label column
        label_col = find_column_name(fieldnames, ["label", "status", "class", "target", "result", "type"])
        if not label_col:
            raise WangchukSchemaError(
                f"MALFORMED_INPUT_SCHEMA: Unable to identify label column. Found headers: {fieldnames}"
            )

        # Process rows: strictly extract url_col and label_col, dropping all other precomputed features
        for row_idx, row in enumerate(reader, start=1):
            if limit is not None and len(accepted) >= limit:
                break

            if not row:
                continue

            raw_url = str(row.get(url_col, "")).strip()
            raw_label_raw = row.get(label_col)
            raw_label = str(raw_label_raw).strip().lower() if raw_label_raw is not None else ""

            # Check 1: Empty raw URL
            if not raw_url:
                quarantined.append({
                    "record_id": f"wangchuk:malformed:{row_idx}",
                    "source": "wangchuk_2026",
                    "source_record_id": str(row_idx),
                    "source_snapshot": source_snapshot,
                    "acquired_at": acquired_at,
                    "raw_url": "",
                    "normalized_url": None,
                    "registered_domain": None,
                    "subdomain": None,
                    "tld": None,
                    "has_ip_host": False,
                    "has_userinfo": False,
                    "has_punycode": False,
                    "label": "quarantine",
                    "label_status": "unverified",
                    "verification_status": "unverified",
                    "original_data_type": "full_url",
                    "split": "quarantine",
                    "quarantine_reason": "EMPTY_RAW_URL: Empty or whitespace-only URL field",
                })
                continue

            # Check 2: Normalize URL offline
            norm = normalize_url(raw_url)
            if not norm.is_valid:
                quarantined.append({
                    "record_id": f"wangchuk:invalid:{row_idx}",
                    "source": "wangchuk_2026",
                    "source_record_id": str(row_idx),
                    "source_snapshot": source_snapshot,
                    "acquired_at": acquired_at,
                    "raw_url": raw_url,
                    "normalized_url": None,
                    "registered_domain": None,
                    "subdomain": None,
                    "tld": None,
                    "has_ip_host": False,
                    "has_userinfo": False,
                    "has_punycode": False,
                    "label": "quarantine",
                    "label_status": "unverified",
                    "verification_status": "unverified",
                    "original_data_type": "full_url",
                    "split": "quarantine",
                    "quarantine_reason": norm.error or "NORMALIZATION_FAILED",
                })
                continue

            # Check 3: Map source label
            if raw_label in phish_vals:
                mapped_label = "phishing"
                # PhishTank records from Wangchuk have no upstream verification proof in the CSV
                # Must NOT fabricate 'verified' status; assign 'unverified'
                label_status = "unverified"
                verification_status = "wangchuk_unverified_phishing"
            elif raw_label in legit_vals:
                # Common Crawl records are candidate/observed legitimate URLs, not proven safe
                mapped_label = "observed_legitimate_url"
                label_status = "candidate"
                verification_status = "common_crawl_observed_candidate"
            else:
                # Ambiguous or unknown label
                quarantined.append({
                    "record_id": f"wangchuk:ambiguous_label:{row_idx}",
                    "source": "wangchuk_2026",
                    "source_record_id": str(row_idx),
                    "source_snapshot": source_snapshot,
                    "acquired_at": acquired_at,
                    "raw_url": raw_url,
                    "normalized_url": norm.normalized_url,
                    "registered_domain": norm.registered_domain,
                    "subdomain": norm.subdomain,
                    "tld": norm.tld,
                    "has_ip_host": norm.has_ip_host,
                    "has_userinfo": norm.has_userinfo,
                    "has_punycode": norm.has_punycode,
                    "label": "quarantine",
                    "label_status": "unverified",
                    "verification_status": "unverified",
                    "original_data_type": "full_url",
                    "split": "quarantine",
                    "quarantine_reason": f"AMBIGUOUS_SOURCE_LABEL: Unrecognized label value '{raw_label}'",
                })
                continue

            # Deterministic, non-fabricated record identifier
            url_hash = hashlib.sha256(norm.normalized_url.encode("utf-8")).hexdigest()[:12]
            rec_id = f"wangchuk:{row_idx}:{url_hash}"

            # Standardized record conforming to RECORD_SCHEMA_FIELDS
            record = {
                "record_id": rec_id,
                "source": "wangchuk_2026",
                "source_record_id": str(row_idx),
                "source_snapshot": source_snapshot,
                "acquired_at": acquired_at,
                "raw_url": raw_url,
                "normalized_url": norm.normalized_url,
                "registered_domain": norm.registered_domain,
                "subdomain": norm.subdomain,
                "tld": norm.tld,
                "has_ip_host": norm.has_ip_host,
                "has_userinfo": norm.has_userinfo,
                "has_punycode": norm.has_punycode,
                "label": mapped_label,
                "label_status": label_status,
                "verification_status": verification_status,
                "original_data_type": "full_url",
                "split": None,
                "quarantine_reason": None,
            }
            accepted.append(record)

    finally:
        if close_stream:
            stream.close()

    return accepted, quarantined

"""
CyberShield Ethiopia — M1 URL Dataset Pilot Configuration & Schemas
"""

import os
from pathlib import Path
from typing import Optional, Tuple

# Paths
BASE_DIR = Path(__file__).resolve().parents[1]
MANIFESTS_DIR = BASE_DIR / "manifests"
RAW_DIR = BASE_DIR / "raw"
QUARANTINE_DIR = BASE_DIR / "quarantine"
CLEANED_DIR = BASE_DIR / "cleaned"
SPLITS_DIR = BASE_DIR / "splits"

# Ensure directories exist
for d in [MANIFESTS_DIR, RAW_DIR, QUARANTINE_DIR, CLEANED_DIR, SPLITS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# Pilot targets (upper bounds, not quotas)
MAX_BENIGN_RECORDS = 1000
MAX_PHISHING_RECORDS = 1000
MAX_BENCHMARK_RECORDS = 1000

# Canonical field names for cleaned dataset records
RECORD_SCHEMA_FIELDS = [
    "record_id",
    "source",
    "source_record_id",
    "source_snapshot",
    "acquired_at",
    "raw_url",
    "normalized_url",
    "registered_domain",
    "subdomain",
    "tld",
    "has_ip_host",
    "has_userinfo",
    "has_punycode",
    "label",
    "label_status",
    "verification_status",
    "original_data_type",
    "split",
    "quarantine_reason",
]

# Allowed values for controlled taxonomy
VALID_LABELS = {
    "phishing",
    "candidate_benign_domain",
    "candidate_benign",
    "observed_legitimate_url",
    "legitimate",
    "quarantine",
}

VALID_LABEL_STATUSES = {
    "verified",
    "candidate",
    "unverified",
    "synthetic",
}

VALID_ORIGINAL_DATA_TYPES = {
    "root_domain",
    "full_url",
}

VALID_SPLITS = {
    "train",
    "val",
    "test",
    "benchmark",
    "quarantine",
    None,
}


def validate_record_schema(
    record: dict,
    allow_legacy_missing_datatype: bool = True,
) -> Tuple[bool, Optional[str]]:
    """
    Validate record against canonical schema and controlled taxonomy.
    Preserves backward compatibility with legacy pilot records where original_data_type is omitted.
    """
    label = record.get("label")
    if label not in VALID_LABELS:
        return False, f"Invalid label: '{label}' not in VALID_LABELS"

    label_status = record.get("label_status")
    if label_status not in VALID_LABEL_STATUSES:
        return False, f"Invalid label_status: '{label_status}' not in VALID_LABEL_STATUSES"

    datatype = record.get("original_data_type")
    if datatype is None:
        if not allow_legacy_missing_datatype:
            return False, "Missing original_data_type in strict mode"
    elif datatype not in VALID_ORIGINAL_DATA_TYPES:
        return False, f"Invalid original_data_type: '{datatype}' not in VALID_ORIGINAL_DATA_TYPES"

    return True, None

# Known multi-tenant / high-abuse platform domains where root domain reputation
# does NOT guarantee path safety
KNOWN_MULTI_TENANT_PLATFORMS = {
    "google.com",
    "sites.google.com",
    "docs.google.com",
    "drive.google.com",
    "firebaseapp.com",
    "web.app",
    "github.io",
    "gitlab.io",
    "pages.dev",
    "workers.dev",
    "weebly.com",
    "wixsite.com",
    "wordpress.com",
    "blogspot.com",
    "azurewebsites.net",
    "blob.core.windows.net",
    "s3.amazonaws.com",
    "ipfs.io",
    "bit.ly",
    "tinyurl.com",
    "t.co",
    "cutt.ly",
    "is.gd",
    "ow.ly",
}

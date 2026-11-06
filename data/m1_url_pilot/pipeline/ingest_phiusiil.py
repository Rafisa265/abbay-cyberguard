"""
CyberShield Ethiopia — M1 URL Dataset Pilot: UCI PhiUSIIL Benchmark Ingestion

Extracts URL-string-only benchmark records from UCI PhiUSIIL Phishing URL Dataset.
Strictly excludes all 50+ HTML, DOM, and website-content features.
Stores records in an isolated benchmark partition, separate from the training corpus.
"""

import csv
import datetime
import hashlib
import io
import zipfile
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import httpx

from data.m1_url_pilot.pipeline.config import (
    MAX_BENCHMARK_RECORDS,
    RAW_DIR,
)
from data.m1_url_pilot.pipeline.normalize import normalize_url

PHIUSIIL_URL = "https://archive.ics.uci.edu/static/public/967/phiusiil+phishing+url+dataset.zip"
PHIUSIIL_SNAPSHOT = "uci_phiusiil_20240303"
PHIUSIIL_CITATION = (
    "Prasad, A. & Chandra, S. (2024). PhiUSIIL Phishing URL (Website) [Dataset]. "
    "UCI Machine Learning Repository. https://doi.org/10.1016/j.cose.2023.103545"
)
PHIUSIIL_LICENSE = "Creative Commons Attribution 4.0 International (CC BY 4.0)"


def fetch_or_load_phiusiil_sample(
    limit: int = MAX_BENCHMARK_RECORDS,
    raw_cache_path: Optional[Path] = None,
) -> List[Tuple[str, int]]:
    """
    Load or fetch a sample of raw (url, label) pairs from PhiUSIIL.
    Only streams the necessary rows from the zip archive.
    Does NOT download or store webpage content.
    """
    if raw_cache_path is None:
        raw_cache_path = RAW_DIR / "phiusiil_sample.csv"

    # If raw sample already exists, read it directly
    if raw_cache_path.exists():
        results = []
        with open(raw_cache_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                results.append((row["url"], int(row["label"])))
                if len(results) >= limit:
                    break
        return results

    # Fetch zip from UCI archive
    resp = httpx.get(PHIUSIIL_URL, timeout=60.0)
    resp.raise_for_status()

    results = []
    with zipfile.ZipFile(io.BytesIO(resp.content)) as z:
        # Locate the CSV file inside the zip
        csv_filename = None
        for name in z.namelist():
            if name.endswith(".csv"):
                csv_filename = name
                break

        if not csv_filename:
            raise FileNotFoundError("PhiUSIIL CSV not found in downloaded zip")

        with z.open(csv_filename) as f:
            # Wrap binary stream in text reader
            text_stream = io.TextIOWrapper(f, encoding="utf-8", errors="replace")
            reader = csv.DictReader(text_stream)

            # Sample balanced legitimate and phishing records up to limit
            phish_count = 0
            legit_count = 0
            half_limit = limit // 2

            for row in reader:
                url = row.get("URL", "").strip()
                label_val = row.get("label", "").strip()
                if not url or label_val not in {"0", "1"}:
                    continue

                label_int = int(label_val)
                if label_int == 0 and phish_count < half_limit:
                    results.append((url, label_int))
                    phish_count += 1
                elif label_int == 1 and legit_count < half_limit:
                    results.append((url, label_int))
                    legit_count += 1

                if phish_count >= half_limit and legit_count >= half_limit:
                    break

    # Cache sample CSV for deterministic reproducibility
    with open(raw_cache_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["url", "label"])
        for u, l in results:
            writer.writerow([u, l])

    return results


def ingest_phiusiil_records(
    samples: List[Tuple[str, int]],
    limit: int = MAX_BENCHMARK_RECORDS,
    acquired_at: Optional[str] = None,
) -> Tuple[List[Dict], List[Dict]]:
    """
    Standardize PhiUSIIL raw sample into benchmark records.
    Discards all 50+ HTML/DOM features; preserves only URL string and label.
    Label mapping:
      0 -> 'phishing'
      1 -> 'legitimate'
    Returns: (accepted_records, quarantined_records)
    """
    accepted = []
    quarantined = []
    if acquired_at is None:
        raw_cache = RAW_DIR / "phiusiil_sample.csv"
        if raw_cache.exists():
            acquired_at = datetime.datetime.fromtimestamp(
                raw_cache.stat().st_mtime, tz=datetime.timezone.utc
            ).isoformat()
        else:
            acquired_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    now_iso = acquired_at

    for idx, (raw_url, label_int) in enumerate(samples[:limit], start=1):
        norm = normalize_url(raw_url)
        if not norm.is_valid:
            quarantined.append({
                "record_id": f"phiusiil:invalid:{idx}",
                "source": "phiusiil_benchmark",
                "source_record_id": str(idx),
                "source_snapshot": PHIUSIIL_SNAPSHOT,
                "acquired_at": now_iso,
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
                "split": "benchmark",
                "quarantine_reason": norm.error or "NORMALIZATION_FAILED",
            })
            continue

        label_name = "phishing" if label_int == 0 else "legitimate"
        rec_id = f"phiusiil:{idx}:{hashlib.sha256(norm.normalized_url.encode('utf-8')).hexdigest()[:12]}"

        record = {
            "record_id": rec_id,
            "source": "phiusiil_benchmark",
            "source_record_id": str(idx),
            "source_snapshot": PHIUSIIL_SNAPSHOT,
            "acquired_at": now_iso,
            "raw_url": raw_url,
            "normalized_url": norm.normalized_url,
            "registered_domain": norm.registered_domain,
            "subdomain": norm.subdomain,
            "tld": norm.tld,
            "has_ip_host": norm.has_ip_host,
            "has_userinfo": norm.has_userinfo,
            "has_punycode": norm.has_punycode,
            "label": label_name,
            "label_status": "verified",
            "verification_status": "phiusiil_curated_benchmark",
            "original_data_type": "full_url",
            "split": "benchmark",
            "quarantine_reason": None,
        }
        accepted.append(record)

    return accepted, quarantined

"""
CyberShield Ethiopia — M1 URL Dataset Pilot: Deduplication & Conflict Quarantine

Deduplicates exact normalized URLs deterministically.
Detects conflicting labels and quarantines records rather than resolving conflicts silently.
"""

from typing import Dict, List, Tuple

from data.m1_url_pilot.pipeline.split_domains import (
    quarantine_compromised_domain_hazards,
)


def deduplicate_records(records: List[Dict]) -> Tuple[List[Dict], List[Dict], List[Dict]]:
    """
    Process records for exact normalized URL duplicates and label conflicts.
    
    Returns:
        (accepted_records, duplicate_records, conflict_quarantined)
    """
    seen_urls: Dict[str, Dict] = {}
    duplicates: List[Dict] = []
    conflict_urls: set = set()

    # Pass 1: Detect conflicts across all records
    for rec in records:
        norm_url = rec.get("normalized_url")
        if not norm_url:
            continue

        label = rec.get("label")
        if norm_url in seen_urls:
            prev_label = seen_urls[norm_url].get("label")
            if prev_label != label:
                # Conflicting label found!
                conflict_urls.add(norm_url)
        else:
            seen_urls[norm_url] = rec

    # Pass 2: Partition into accepted, duplicate, and quarantined conflicts
    accepted: List[Dict] = []
    conflict_quarantined: List[Dict] = []
    accepted_norm_urls: set = set()

    for rec in records:
        norm_url = rec.get("normalized_url")
        if not norm_url:
            continue

        # Check if URL was flagged as conflicting
        if norm_url in conflict_urls:
            quarantined_rec = dict(rec)
            quarantined_rec["label"] = "quarantine"
            quarantined_rec["split"] = "quarantine"
            quarantined_rec["quarantine_reason"] = (
                f"CONFLICTING_SOURCE_LABELS: URL appeared with multiple conflicting labels"
            )
            conflict_quarantined.append(quarantined_rec)
            continue

        # Check for exact duplicate
        if norm_url in accepted_norm_urls:
            duplicates.append(rec)
        else:
            accepted_norm_urls.add(norm_url)
            accepted.append(rec)

    return accepted, duplicates, conflict_quarantined

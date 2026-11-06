"""
CyberShield Ethiopia — M1 URL Dataset Pilot: Quality Audit & Leakage Verification

Generates factual, reproducible audit reports covering:
- Input, accepted, duplicate, quarantined, and skipped counts by source.
- Label and verification-status distributions.
- Missing and malformed field counts.
- Cross-source URL and domain overlaps.
- Domain leakage verification across train/val/test splits.
- Benchmark isolation checks.
"""

from collections import Counter
from typing import Dict, List, Optional, Set


def perform_quality_audit(
    all_raw_counts: Dict[str, int],
    accepted_records: List[Dict],
    quarantined_records: List[Dict],
    duplicate_records: List[Dict],
    benchmark_records: Optional[List[Dict]] = None,
    split_records: Optional[Dict[str, List[Dict]]] = None,
) -> Dict:
    """
    Perform comprehensive quality audit and return structured audit results dictionary.
    """
    benchmark_records = benchmark_records or []
    split_records = split_records or {}

    total_input = sum(all_raw_counts.values())
    total_accepted = len(accepted_records)
    total_quarantined = len(quarantined_records)
    total_duplicates = len(duplicate_records)
    total_benchmark = len(benchmark_records)

    # 1. Counts by source
    counts_by_source: Dict[str, Dict[str, int]] = {}
    for src in all_raw_counts:
        counts_by_source[src] = {
            "raw_input": all_raw_counts.get(src, 0),
            "accepted": 0,
            "quarantined": 0,
            "duplicate": 0,
        }

    for rec in accepted_records:
        src = rec.get("source", "unknown")
        if src not in counts_by_source:
            counts_by_source[src] = {"raw_input": 0, "accepted": 0, "quarantined": 0, "duplicate": 0}
        counts_by_source[src]["accepted"] += 1

    for rec in quarantined_records:
        src = rec.get("source", "unknown")
        if src not in counts_by_source:
            counts_by_source[src] = {"raw_input": 0, "accepted": 0, "quarantined": 0, "duplicate": 0}
        counts_by_source[src]["quarantined"] += 1

    for rec in duplicate_records:
        src = rec.get("source", "unknown")
        if src not in counts_by_source:
            counts_by_source[src] = {"raw_input": 0, "accepted": 0, "quarantined": 0, "duplicate": 0}
        counts_by_source[src]["duplicate"] += 1

    # 2. Label distribution
    label_dist = Counter(rec.get("label") for rec in accepted_records)
    label_status_dist = Counter(rec.get("label_status") for rec in accepted_records)
    verification_status_dist = Counter(rec.get("verification_status") for rec in accepted_records)

    # 3. Missing or malformed field checks
    missing_fields = Counter()
    required_fields = [
        "record_id", "source", "source_snapshot", "raw_url", "normalized_url",
        "registered_domain", "label", "label_status", "verification_status"
    ]
    for rec in accepted_records:
        for f in required_fields:
            val = rec.get(f)
            if val is None or val == "":
                missing_fields[f] += 1

    # 4. Quarantine reasons breakdown
    quarantine_reasons = Counter(rec.get("quarantine_reason") for rec in quarantined_records)

    # 5. Overlap across sources (Main corpus vs Benchmark)
    pilot_domains: Set[str] = {
        rec.get("registered_domain") or rec.get("hostname")
        for rec in accepted_records
        if rec.get("registered_domain") or rec.get("hostname")
    }

    benchmark_domains: Set[str] = {
        rec.get("registered_domain") or rec.get("hostname")
        for rec in benchmark_records
        if rec.get("registered_domain") or rec.get("hostname")
    }

    pilot_urls: Set[str] = {rec.get("normalized_url") for rec in accepted_records if rec.get("normalized_url")}
    benchmark_urls: Set[str] = {rec.get("normalized_url") for rec in benchmark_records if rec.get("normalized_url")}

    url_overlap_with_benchmark = pilot_urls.intersection(benchmark_urls)
    domain_overlap_with_benchmark = pilot_domains.intersection(benchmark_domains)

    # 6. Split domain leakage check
    split_leakage = {
        "train_val_overlap": 0,
        "train_test_overlap": 0,
        "val_test_overlap": 0,
        "is_leakage_free": True,
    }

    if split_records:
        domains_train = {r.get("registered_domain") for r in split_records.get("train", []) if r.get("registered_domain")}
        domains_val = {r.get("registered_domain") for r in split_records.get("val", []) if r.get("registered_domain")}
        domains_test = {r.get("registered_domain") for r in split_records.get("test", []) if r.get("registered_domain")}

        tv = len(domains_train.intersection(domains_val))
        tt = len(domains_train.intersection(domains_test))
        vt = len(domains_val.intersection(domains_test))

        split_leakage["train_val_overlap"] = tv
        split_leakage["train_test_overlap"] = tt
        split_leakage["val_test_overlap"] = vt
        split_leakage["is_leakage_free"] = (tv == 0 and tt == 0 and vt == 0)

    # 7. Candidate benign vs verified breakdown
    candidate_benign_count = sum(1 for r in accepted_records if r.get("label_status") == "candidate")
    verified_phish_count = sum(1 for r in accepted_records if r.get("label") == "phishing" and r.get("label_status") == "verified")

    audit_report = {
        "summary": {
            "total_raw_input": total_input,
            "total_accepted": total_accepted,
            "total_quarantined": total_quarantined,
            "total_duplicates": total_duplicates,
            "total_benchmark": total_benchmark,
            "candidate_benign_records": candidate_benign_count,
            "verified_phishing_records": verified_phish_count,
        },
        "counts_by_source": counts_by_source,
        "label_distribution": dict(label_dist),
        "label_status_distribution": dict(label_status_dist),
        "verification_status_distribution": dict(verification_status_dist),
        "missing_fields": dict(missing_fields),
        "quarantine_reasons": dict(quarantine_reasons),
        "cross_source_overlap": {
            "pilot_unique_domains": len(pilot_domains),
            "benchmark_unique_domains": len(benchmark_domains),
            "url_overlap_with_benchmark": len(url_overlap_with_benchmark),
            "domain_overlap_with_benchmark": len(domain_overlap_with_benchmark),
            "overlapping_domain_samples": sorted(list(domain_overlap_with_benchmark))[:10],
        },
        "split_leakage_audit": split_leakage,
    }

    return audit_report

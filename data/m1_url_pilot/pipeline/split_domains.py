"""
CyberShield Ethiopia — M1 URL Dataset Pilot: Domain-Grouped Splitting

Partitions dataset into Train, Validation, and Test splits grouped strictly by registered domain.
Guarantees 0% domain leakage between partitions using deterministic domain hashing.
"""

import hashlib
import json
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple, Union

BENIGN_LABELS: Set[str] = {
    "candidate_benign_domain",
    "candidate_benign",
    "observed_legitimate_url",
    "legitimate",
}
PHISHING_LABELS: Set[str] = {
    "phishing",
}


class BenchmarkIsolationError(RuntimeError):
    """Raised when benchmark isolation cannot be guaranteed (fail-closed security)."""
    pass


def load_benchmark_registered_domains(
    benchmark_path: Optional[Union[str, Path]] = None,
) -> Set[str]:
    """
    Load the set of registered domains from the isolated benchmark dataset using pinned PSL.
    
    Fail-closed guarantee:
    If the benchmark file cannot be read, does not exist, or yields 0 valid registered domains,
    raises BenchmarkIsolationError. The pipeline MUST NEVER proceed without strict isolation.
    """
    if benchmark_path is None:
        from data.m1_url_pilot.pipeline.config import SPLITS_DIR
        benchmark_file = SPLITS_DIR / "benchmark_phiusiil.jsonl"
    else:
        benchmark_file = Path(benchmark_path)

    if not benchmark_file.exists():
        raise BenchmarkIsolationError(
            f"BENCHMARK_ISOLATION_FAILURE: Benchmark file not found at '{benchmark_file}'. "
            f"Failing closed to prevent potential benchmark data leakage."
        )

def extract_canonical_registered_domain(rec: Dict) -> Optional[str]:
    """
    Extract the canonical registered domain for a record per the authoritative PSL policy.
    
    Policy (strictly aligned with dataset normalization):
    1. If raw_url or normalized_url is present, normalize via authoritative pinned PSL
       with include_private=True to isolate private multi-tenant domains (e.g. *.github.io, *.pages.dev).
    2. If the URL is hosted on a bare multi-tenant platform root without tenant label
       (e.g. s3.amazonaws.com), fall back to ICANN eTLD+1 (amazonaws.com).
    3. If only registered_domain is provided, validate it is not a bare public suffix,
       falling back to ICANN decomposition if it is a bare private suffix.
    4. If only hostname is provided, decompose via pinned PSL.
    """
    from data.m1_url_pilot.pipeline.psl import get_psl
    psl = get_psl()

    url = rec.get("normalized_url") or rec.get("raw_url")
    if url and isinstance(url, str) and url.strip():
        from data.m1_url_pilot.pipeline.normalize import normalize_url
        norm = normalize_url(url, include_private=True)
        if norm.is_valid and norm.registered_domain:
            return norm.registered_domain.lower()
        if norm.is_valid:
            norm_icann = normalize_url(url, include_private=False)
            if norm_icann.is_valid and norm_icann.registered_domain:
                return norm_icann.registered_domain.lower()

    raw_reg = rec.get("registered_domain")
    if raw_reg and isinstance(raw_reg, str) and raw_reg.strip():
        cand = raw_reg.strip().lower()
        if not psl.is_public_suffix(cand, include_private=True):
            return cand
        _, icann_reg, _ = psl.decompose(cand, include_private=False)
        if icann_reg:
            return icann_reg.lower()

    raw_host = rec.get("hostname")
    if raw_host and isinstance(raw_host, str) and raw_host.strip():
        cand = raw_host.strip().lower()
        _, decomp_reg, _ = psl.decompose(cand, include_private=True)
        if decomp_reg:
            return decomp_reg.lower()
        _, icann_reg, _ = psl.decompose(cand, include_private=False)
        if icann_reg:
            return icann_reg.lower()

    return None


def load_benchmark_registered_domains(
    benchmark_path: Optional[Union[str, Path]] = None,
) -> Set[str]:
    """
    Load the set of registered domains from the isolated benchmark dataset using pinned PSL.
    
    Fail-closed guarantee:
    If the benchmark file cannot be read, does not exist, contains malformed JSON, or if ANY
    record cannot be resolved to a canonical registered domain, raises BenchmarkIsolationError.
    The pipeline MUST NEVER silently proceed with partial or corrupted benchmark isolation.
    """
    if benchmark_path is None:
        from data.m1_url_pilot.pipeline.config import SPLITS_DIR
        benchmark_file = SPLITS_DIR / "benchmark_phiusiil.jsonl"
    else:
        benchmark_file = Path(benchmark_path)

    if not benchmark_file.exists():
        raise BenchmarkIsolationError(
            f"BENCHMARK_ISOLATION_FAILURE: Benchmark file not found at '{benchmark_file}'. "
            f"Failing closed to prevent potential benchmark data leakage."
        )

    try:
        from data.m1_url_pilot.pipeline.psl import get_psl
        get_psl()
    except Exception as e:
        raise BenchmarkIsolationError(
            f"BENCHMARK_ISOLATION_FAILURE: Could not initialize pinned PSL engine: {e}. Failing closed."
        ) from e

    benchmark_domains: Set[str] = set()
    try:
        with open(benchmark_file, "r", encoding="utf-8") as f:
            for line_no, raw_line in enumerate(f, start=1):
                line = raw_line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                except Exception as json_err:
                    raise BenchmarkIsolationError(
                        f"BENCHMARK_ISOLATION_FAILURE: Line {line_no} in benchmark file '{benchmark_file}' "
                        f"contains malformed JSON: {json_err}. Failing closed."
                    ) from json_err

                domain = extract_canonical_registered_domain(data)
                if not domain:
                    raise BenchmarkIsolationError(
                        f"BENCHMARK_ISOLATION_FAILURE: Record {line_no} in benchmark file '{benchmark_file}' "
                        f"could not be resolved to a canonical registered domain. Failing closed."
                    )
                benchmark_domains.add(domain)
    except Exception as e:
        if isinstance(e, BenchmarkIsolationError):
            raise
        raise BenchmarkIsolationError(
            f"BENCHMARK_ISOLATION_FAILURE: Error reading benchmark file at '{benchmark_file}': {e}. "
            f"Failing closed."
        ) from e

    if not benchmark_domains:
        raise BenchmarkIsolationError(
            f"BENCHMARK_ISOLATION_FAILURE: Benchmark at '{benchmark_file}' contains zero valid registered domains. "
            f"Failing closed."
        )

    return benchmark_domains


def quarantine_benchmark_collisions(
    records: List[Dict],
    benchmark_domains: Set[str],
    quarantined_records: Optional[List[Dict]] = None,
) -> Tuple[List[Dict], List[Dict]]:
    """
    Quarantine any candidate records whose registered domain collides with the benchmark.
    Uses the exact same canonical registered-domain policy as the benchmark loader.
    
    Returns:
        (clean_records, collision_quarantined)
    """
    clean_records: List[Dict] = []
    collision_quarantined: List[Dict] = []

    for rec in records:
        # Separate benchmark records: the benchmark itself is not a candidate collision with itself
        if rec.get("source") == "phiusiil_benchmark" or rec.get("split") == "benchmark":
            clean_records.append(rec)
            continue

        domain = extract_canonical_registered_domain(rec)

        if not domain:
            quarantined_rec = dict(rec)
            quarantined_rec["label"] = "quarantine"
            quarantined_rec["split"] = "quarantine"
            if "original_label" not in quarantined_rec:
                quarantined_rec["original_label"] = rec.get("label")
            quarantined_rec["quarantine_reason"] = (
                "UNRESOLVABLE_DOMAIN: Candidate record domain could not be reliably determined for benchmark isolation"
            )
            collision_quarantined.append(quarantined_rec)
            if quarantined_records is not None:
                rec_id = quarantined_rec.get("record_id")
                already_present = any(
                    (rec_id is not None and q.get("record_id") == rec_id) or (q is quarantined_rec)
                    for q in quarantined_records
                )
                if not already_present:
                    quarantined_records.append(quarantined_rec)
        elif domain in benchmark_domains:
            quarantined_rec = dict(rec)
            quarantined_rec["label"] = "quarantine"
            quarantined_rec["split"] = "quarantine"
            if "original_label" not in quarantined_rec:
                quarantined_rec["original_label"] = rec.get("label")
            quarantined_rec["quarantine_reason"] = (
                f"BENCHMARK_DOMAIN_COLLISION: Domain '{domain}' collides with isolated PhiUSIIL benchmark"
            )
            collision_quarantined.append(quarantined_rec)
            if quarantined_records is not None:
                rec_id = quarantined_rec.get("record_id")
                already_present = any(
                    (rec_id is not None and q.get("record_id") == rec_id) or (q is quarantined_rec)
                    for q in quarantined_records
                )
                if not already_present:
                    quarantined_records.append(quarantined_rec)
        else:
            clean_records.append(rec)

    return clean_records, collision_quarantined


def quarantine_compromised_domain_hazards(
    records: List[Dict],
    quarantined_records: Optional[List[Dict]] = None,
) -> Tuple[List[Dict], List[Dict]]:
    """
    Detect registered domains containing both phishing and benign/legitimate records across different paths.
    Applies the COMPROMISED_DOMAIN_SPLIT_HAZARD quarantine policy to prevent cross-partition split hazards.
    
    Crucial distinctions:
    - Identical canonical URLs with conflicting labels are handled separately by deduplicate_records (CONFLICTING_SOURCE_LABELS).
    - Different paths on the same domain that share the SAME label type (all phishing, or all benign) are NOT quarantined.
    - Only domains with mixed labels (both phishing AND benign) are flagged as COMPROMISED_DOMAIN_SPLIT_HAZARD.
    
    Returns:
        (clean_records, hazard_quarantined)
    """
    from data.m1_url_pilot.pipeline.psl import get_psl
    psl = get_psl()

    # Pass 1: Map label categories present for each registered domain
    domain_label_types: Dict[str, Set[str]] = {}
    for rec in records:
        if rec.get("split") == "quarantine" or rec.get("label") == "quarantine":
            continue
        if rec.get("source") == "phiusiil_benchmark" or rec.get("split") == "benchmark":
            continue

        domain = extract_canonical_registered_domain(rec)
        if not domain:
            continue

        lbl = rec.get("label")
        if lbl in PHISHING_LABELS:
            cat = "phishing"
        elif lbl in BENIGN_LABELS:
            cat = "benign"
        else:
            continue

        if domain not in domain_label_types:
            domain_label_types[domain] = set()
        domain_label_types[domain].add(cat)

    # Domains hosting both phishing lures and legitimate content
    compromised_domains = {
        dom for dom, cats in domain_label_types.items()
        if "phishing" in cats and "benign" in cats
    }

    # Pass 2: Quarantine records on compromised domains
    clean_records: List[Dict] = []
    hazard_quarantined: List[Dict] = []

    for rec in records:
        domain = extract_canonical_registered_domain(rec)

        if domain and domain in compromised_domains:
            quarantined_rec = dict(rec)
            quarantined_rec["label"] = "quarantine"
            quarantined_rec["split"] = "quarantine"
            if "original_label" not in quarantined_rec:
                quarantined_rec["original_label"] = rec.get("label")
            quarantined_rec["quarantine_reason"] = (
                f"COMPROMISED_DOMAIN_SPLIT_HAZARD: Domain '{domain}' contains both phishing and legitimate records"
            )
            hazard_quarantined.append(quarantined_rec)
            if quarantined_records is not None:
                rec_id = quarantined_rec.get("record_id")
                already_present = any(
                    (rec_id is not None and q.get("record_id") == rec_id) or (q is quarantined_rec)
                    for q in quarantined_records
                )
                if not already_present:
                    quarantined_records.append(quarantined_rec)
        else:
            clean_records.append(rec)

    return clean_records, hazard_quarantined


def assign_domain_split(domain: Optional[str]) -> str:
    """
    Deterministic domain partition assignment via SHA-256 modulo.
    
    Ratios:
    - 00 to 69 (70%): train
    - 70 to 84 (15%): val
    - 85 to 99 (15%): test
    
    Deterministic guarantee:
    Identical domain always maps to the same split, preventing domain leakage.
    Returns 'quarantine' if domain is None, empty, whitespace, non-string,
    or a public-suffix-only hostname (e.g. 'co.uk', 'gov.et', 'com').
    """
    if not domain or not isinstance(domain, str) or not domain.strip():
        return "quarantine"

    clean_domain = domain.strip().lower()

    # Reject public-suffix-only names via authoritative PSL engine
    try:
        from data.m1_url_pilot.pipeline.psl import get_psl
        if get_psl().is_public_suffix(clean_domain, include_private=True):
            return "quarantine"
    except Exception:
        pass

    # Compute deterministic bucket [0, 99]
    digest = hashlib.sha256(clean_domain.encode("utf-8")).hexdigest()
    bucket = int(digest[:8], 16) % 100

    if bucket < 70:
        return "train"
    elif bucket < 85:
        return "val"
    else:
        return "test"


def partition_records_by_domain(
    records: List[Dict],
    quarantined_records: Optional[List[Dict]] = None,
    benchmark_domains: Optional[Set[str]] = None,
    benchmark_path: Optional[Union[str, Path]] = None,
    enforce_benchmark_isolation: bool = False,
    enforce_compromised_quarantine: bool = True,
) -> Tuple[List[Dict], List[Dict], List[Dict], Dict[str, set]]:
    """
    Partition records into (train, val, test) with strict domain isolation.
    
    Guarantees:
    - Proactive benchmark domain collision quarantine (if enabled or benchmark_domains/path provided).
    - Compromised domain split-hazard quarantine (domains hosting both phishing and benign records).
    - Strict 0% cross-partition domain leakage.
    - Deterministic SHA-256 partition hashing.
    
    Returns:
        (train_records, val_records, test_records, domain_sets_by_split)
    """
    # 1. Proactive Benchmark Collision Quarantine
    if enforce_benchmark_isolation or benchmark_domains is not None or benchmark_path is not None:
        if benchmark_domains is None:
            benchmark_domains = load_benchmark_registered_domains(benchmark_path)
        records, _ = quarantine_benchmark_collisions(
            records, benchmark_domains, quarantined_records=quarantined_records
        )

    # 2. Compromised Domain Split Hazard Quarantine
    if enforce_compromised_quarantine:
        records, _ = quarantine_compromised_domain_hazards(
            records, quarantined_records=quarantined_records
        )

    train_records = []
    val_records = []
    test_records = []

    domain_sets = {
        "train": set(),
        "val": set(),
        "test": set(),
        "quarantine": set(),
    }

    for rec in records:
        # Separate benchmark records: they stay in benchmark split
        if rec.get("source") == "phiusiil_benchmark" or rec.get("split") == "benchmark":
            continue

        domain = extract_canonical_registered_domain(rec)
        split_name = assign_domain_split(domain)

        assigned_rec = dict(rec)
        assigned_rec["split"] = split_name

        if split_name == "quarantine":
            if not assigned_rec.get("quarantine_reason"):
                assigned_rec["quarantine_reason"] = (
                    "UNRESOLVABLE_DOMAIN: Missing, empty, non-string, or public-suffix-only domain"
                )
            if "original_label" not in assigned_rec:
                assigned_rec["original_label"] = rec.get("label")
            assigned_rec["label"] = "quarantine"
            domain_sets["quarantine"].add(domain or "unresolvable")
            if quarantined_records is not None:
                # Avoid duplicate quarantine entries if the same record is already present
                rec_id = assigned_rec.get("record_id")
                already_present = any(
                    (rec_id is not None and q.get("record_id") == rec_id) or (q is assigned_rec)
                    for q in quarantined_records
                )
                if not already_present:
                    quarantined_records.append(assigned_rec)
            # Crucial: quarantine records are NEVER added to train, val, or test partitions!
            continue

        if split_name == "train":
            train_records.append(assigned_rec)
            domain_sets["train"].add(domain)
        elif split_name == "val":
            val_records.append(assigned_rec)
            domain_sets["val"].add(domain)
        elif split_name == "test":
            test_records.append(assigned_rec)
            domain_sets["test"].add(domain)

    # Verification of zero leakage across train, val, and test
    train_val_overlap = domain_sets["train"].intersection(domain_sets["val"])
    train_test_overlap = domain_sets["train"].intersection(domain_sets["test"])
    val_test_overlap = domain_sets["val"].intersection(domain_sets["test"])

    if train_val_overlap or train_test_overlap or val_test_overlap:
        raise RuntimeError(
            f"Domain leakage detected! Overlaps: train-val={len(train_val_overlap)}, "
            f"train-test={len(train_test_overlap)}, val-test={len(val_test_overlap)}"
        )

    return train_records, val_records, test_records, domain_sets

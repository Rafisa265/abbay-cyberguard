"""
CyberShield Ethiopia — M1 URL Dataset Pilot Runner
Controlled acquisition, cleaning, deduplication, domain splitting, and quality audit.

Usage:
    python data/m1_url_pilot/run_pipeline.py [--skip-benchmark] [--dry-run]
"""

import argparse
import datetime
import json
import sys
from pathlib import Path

# Add repository root to pythonpath
REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from data.m1_url_pilot.pipeline.audit import perform_quality_audit
from data.m1_url_pilot.pipeline.config import (
    CLEANED_DIR,
    MANIFESTS_DIR,
    MAX_BENCHMARK_RECORDS,
    MAX_BENIGN_RECORDS,
    QUARANTINE_DIR,
    RAW_DIR,
    SPLITS_DIR,
)
from data.m1_url_pilot.pipeline.deduplicate import deduplicate_records
from data.m1_url_pilot.pipeline.ingest_phishtank import (
    check_phishtank_availability,
    ingest_phishtank_records,
)
from data.m1_url_pilot.pipeline.ingest_urlhaus import (
    check_urlhaus_availability,
    fetch_urlhaus_feed,
    parse_urlhaus_csv,
    URLHAUS_TERMS,
)
from data.m1_url_pilot.pipeline.ingest_phiusiil import (
    PHIUSIIL_CITATION,
    PHIUSIIL_LICENSE,
    PHIUSIIL_URL,
    fetch_or_load_phiusiil_sample,
    ingest_phiusiil_records,
)
from data.m1_url_pilot.pipeline.ingest_tranco import (
    TRANCO_DOWNLOAD_URL,
    TRANCO_LIST_ID,
    TRANCO_SNAPSHOT,
    fetch_or_load_tranco_raw,
    ingest_tranco_records,
)
from data.m1_url_pilot.pipeline.provenance import append_provenance_events
from data.m1_url_pilot.pipeline.split_domains import partition_records_by_domain


def run_pilot_pipeline(include_benchmark: bool = True, dry_run: bool = False) -> dict:
    """
    Run the end-to-end controlled acquisition, normalization, deduplication,
    domain-grouped split, and audit pipeline.
    """
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    raw_counts = {}
    all_accepted = []
    all_quarantined = []
    all_duplicates = []
    audit_events = []

    # Preserve baseline acquisition timestamps if cleaned files exist
    tranco_acquired_at = None
    pilot_corpus_path = CLEANED_DIR / "pilot_corpus.jsonl"
    if pilot_corpus_path.exists():
        try:
            with open(pilot_corpus_path, "r", encoding="utf-8") as f:
                first_line = f.readline().strip()
                if first_line:
                    tranco_acquired_at = json.loads(first_line).get("acquired_at")
        except Exception:
            pass

    benchmark_acquired_at = None
    bench_file = SPLITS_DIR / "benchmark_phiusiil.jsonl"
    if bench_file.exists():
        try:
            with open(bench_file, "r", encoding="utf-8") as f:
                first_line = f.readline().strip()
                if first_line:
                    benchmark_acquired_at = json.loads(first_line).get("acquired_at")
        except Exception:
            pass

    print("================================================================================")
    print("CyberShield Ethiopia — M1 URL Dataset Pilot Pipeline")
    print(f"Timestamp: {now_iso}")
    print("================================================================================")

    # -------------------------------------------------------------------------
    # 1. Source: Tranco List
    # -------------------------------------------------------------------------
    print("\n[1/4] Processing Tranco candidate benign domains...")
    try:
        tranco_csv = fetch_or_load_tranco_raw(limit=MAX_BENIGN_RECORDS)
        tranco_rows = [r for r in tranco_csv.strip().splitlines() if r]
        raw_counts["tranco"] = min(len(tranco_rows), MAX_BENIGN_RECORDS)
        tranco_accepted, tranco_quarantined = ingest_tranco_records(
            tranco_csv,
            limit=MAX_BENIGN_RECORDS,
            quarantine_multi_tenant=True,
            acquired_at=tranco_acquired_at,
        )
        all_accepted.extend(tranco_accepted)
        all_quarantined.extend(tranco_quarantined)
        print(f"  Tranco: {raw_counts['tranco']} raw rows -> {len(tranco_accepted)} accepted, {len(tranco_quarantined)} quarantined")
        audit_events.append({
            "event": "ingest_tranco",
            "source": "tranco",
            "list_id": TRANCO_LIST_ID,
            "raw_input": raw_counts["tranco"],
            "accepted": len(tranco_accepted),
            "quarantined": len(tranco_quarantined),
            "timestamp": now_iso,
        })
    except Exception as e:
        print(f"  Tranco acquisition failed: {e}")
        raw_counts["tranco"] = 0

    # -------------------------------------------------------------------------
    # 2. Source: PhishTank
    # -------------------------------------------------------------------------
    print("\n[2/4] Checking PhishTank phishing source...")
    phish_avail, phish_msg = check_phishtank_availability()
    print(f"  Status: {phish_msg}")
    raw_counts["phishtank"] = 0
    audit_events.append({
        "event": "check_phishtank",
        "source": "phishtank",
        "available": phish_avail,
        "status_message": phish_msg,
        "action": "skipped_per_safety_policy" if not phish_avail else "processed",
        "timestamp": now_iso,
    })

    # If raw cache exists or key configured, process it
    if phish_avail:
        raw_file = RAW_DIR / "phishtank_online_valid.json"
        if raw_file.exists():
            with open(raw_file, "r", encoding="utf-8") as f:
                pt_data = json.load(f)
            raw_counts["phishtank"] = len(pt_data)
            pt_accepted, pt_quarantined = ingest_phishtank_records(pt_data)
            all_accepted.extend(pt_accepted)
            all_quarantined.extend(pt_quarantined)
            print(f"  PhishTank: {len(pt_data)} raw rows -> {len(pt_accepted)} accepted, {len(pt_quarantined)} quarantined")

    # -------------------------------------------------------------------------
    # 2b. Source: URLhaus (abuse.ch)
    # -------------------------------------------------------------------------
    print("\n[2b/4] Checking URLhaus (abuse.ch) source...")
    urlhaus_avail, urlhaus_msg = check_urlhaus_availability()
    print(f"  Status: {urlhaus_msg}")
    raw_counts["urlhaus"] = 0
    audit_events.append({
        "event": "check_urlhaus",
        "source": "urlhaus",
        "available": urlhaus_avail,
        "status_message": urlhaus_msg,
        "action": "skipped_per_safety_policy" if not urlhaus_avail else "processed",
        "timestamp": now_iso,
    })

    if urlhaus_avail:
        uh_content, uh_checksum, uh_err = fetch_urlhaus_feed()
        if uh_content:
            uh_accepted, uh_quarantined = parse_urlhaus_csv(uh_content, content_checksum=uh_checksum)
            raw_counts["urlhaus"] = len(uh_accepted) + len(uh_quarantined)
            all_accepted.extend(uh_accepted)
            all_quarantined.extend(uh_quarantined)
            print(f"  URLhaus: {raw_counts['urlhaus']} rows -> {len(uh_accepted)} verified phishing, {len(uh_quarantined)} quarantined (malware/offline)")
            audit_events.append({
                "event": "ingest_urlhaus",
                "source": "urlhaus",
                "raw_input": raw_counts["urlhaus"],
                "accepted_phishing": len(uh_accepted),
                "quarantined": len(uh_quarantined),
                "content_checksum": uh_checksum,
                "timestamp": now_iso,
            })
        else:
            print(f"  URLhaus fetch skipped: {uh_err}")

    # -------------------------------------------------------------------------
    # 3. Source: UCI PhiUSIIL Benchmark (Optional / Isolated)
    # -------------------------------------------------------------------------
    benchmark_accepted = []
    if include_benchmark:
        print("\n[3/4] Processing UCI PhiUSIIL Research Benchmark...")
        try:
            phiusiil_samples = fetch_or_load_phiusiil_sample(limit=MAX_BENCHMARK_RECORDS)
            raw_counts["phiusiil_benchmark"] = len(phiusiil_samples)
            benchmark_accepted, benchmark_quarantined = ingest_phiusiil_records(
                phiusiil_samples,
                limit=MAX_BENCHMARK_RECORDS,
                acquired_at=benchmark_acquired_at,
            )
            all_quarantined.extend(benchmark_quarantined)
            print(f"  PhiUSIIL: {len(phiusiil_samples)} sampled -> {len(benchmark_accepted)} accepted as isolated benchmark, {len(benchmark_quarantined)} quarantined")
            audit_events.append({
                "event": "ingest_phiusiil_benchmark",
                "source": "phiusiil_benchmark",
                "raw_input": len(phiusiil_samples),
                "accepted_benchmark": len(benchmark_accepted),
                "quarantined": len(benchmark_quarantined),
                "timestamp": now_iso,
            })
        except Exception as e:
            print(f"  PhiUSIIL benchmark processing failed: {e}")
            raw_counts["phiusiil_benchmark"] = 0

    # -------------------------------------------------------------------------
    # 4. Deduplication & Conflict Detection
    # -------------------------------------------------------------------------
    print("\n[4/4] Deduplicating and partitioning domain splits...")
    accepted_clean, dup_records, conflict_records = deduplicate_records(all_accepted)
    all_duplicates.extend(dup_records)
    all_quarantined.extend(conflict_records)
    print(f"  Deduplication: {len(all_accepted)} input -> {len(accepted_clean)} unique, {len(dup_records)} duplicates, {len(conflict_records)} conflicting quarantined")

    # -------------------------------------------------------------------------
    # 5. Domain-Grouped Splitting (Pilot Corpus)
    # -------------------------------------------------------------------------
    train_recs, val_recs, test_recs, domain_sets = partition_records_by_domain(
        accepted_clean,
        quarantined_records=all_quarantined,
        enforce_benchmark_isolation=include_benchmark,
    )
    print(f"  Domain-Grouped Split: Train={len(train_recs)} urls ({len(domain_sets['train'])} domains), "
          f"Val={len(val_recs)} urls ({len(domain_sets['val'])} domains), "
          f"Test={len(test_recs)} urls ({len(domain_sets['test'])} domains)")

    # Exclude any records newly quarantined during domain splitting from accepted_clean
    quarantined_ids = {r.get("record_id") for r in all_quarantined if r.get("record_id")}
    accepted_clean = [r for r in accepted_clean if r.get("record_id") not in quarantined_ids]

    split_recs_map = {
        "train": train_recs,
        "val": val_recs,
        "test": test_recs,
    }

    # -------------------------------------------------------------------------
    # 6. Quality Audit
    # -------------------------------------------------------------------------
    audit_results = perform_quality_audit(
        all_raw_counts=raw_counts,
        accepted_records=accepted_clean,
        quarantined_records=all_quarantined,
        duplicate_records=all_duplicates,
        benchmark_records=benchmark_accepted,
        split_records=split_recs_map,
    )

    if dry_run:
        print("\nDry-run mode: skipping file writes.")
        return audit_results

    # -------------------------------------------------------------------------
    # 7. Write Output Artifacts
    # -------------------------------------------------------------------------
    print("\nWriting dataset artifacts to disk...")

    # Write cleaned pilot corpus
    pilot_corpus_path = CLEANED_DIR / "pilot_corpus.jsonl"
    with open(pilot_corpus_path, "w", encoding="utf-8") as f:
        for r in accepted_clean:
            f.write(json.dumps(r) + "\n")

    # Write summary
    summary_path = CLEANED_DIR / "pilot_corpus.summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(audit_results, f, indent=2)

    # Write quarantined records
    quarantine_path = QUARANTINE_DIR / "quarantined_records.jsonl"
    with open(quarantine_path, "w", encoding="utf-8") as f:
        for r in all_quarantined:
            f.write(json.dumps(r) + "\n")

    # Write splits
    for split_name, split_list in split_recs_map.items():
        split_file = SPLITS_DIR / f"{split_name}.jsonl"
        with open(split_file, "w", encoding="utf-8") as f:
            for r in split_list:
                f.write(json.dumps(r) + "\n")

    # Write benchmark split if present
    if benchmark_accepted:
        bench_file = SPLITS_DIR / "benchmark_phiusiil.jsonl"
        with open(bench_file, "w", encoding="utf-8") as f:
            for r in benchmark_accepted:
                f.write(json.dumps(r) + "\n")

    # Write provenance audit log idempotently
    provenance_path = MANIFESTS_DIR / "provenance_audit.jsonl"
    newly_appended = append_provenance_events(provenance_path, audit_events)
    if newly_appended:
        print(f"  Provenance Audit: Appended {len(newly_appended)} new audit events to {provenance_path.name}")
    else:
        print(f"  Provenance Audit: 0 new events (all events matched existing historical fingerprints)")

    # Build source manifest
    source_manifest_sources = {
        "tranco": {
            "source_name": "Tranco Research-Oriented Top Sites Ranking",
            "official_url": "https://tranco-list.eu/",
            "list_id": TRANCO_LIST_ID,
            "snapshot_id": TRANCO_SNAPSHOT,
            "download_url": TRANCO_DOWNLOAD_URL,
            "attribution": "Victor Le Pochat, Tom Van Goethem, Samaneh Tajalizadehkashani, and Wouter Joosen (NDSS 2019)",
            "license": "Composite ranking from 5 underlying sources: Cisco Umbrella (free), Majestic (CC BY 3.0), Farsight (free), CrUX (CC BY-SA 4.0), and Cloudflare Radar (CC BY-NC 4.0)",
            "permitted_use": "Permitted for non-commercial cybersecurity research and offline evaluation with paper citation. Commercial downstream use requires legal/terms review.",
            "licensing_review_status": "requires_legal_terms_review_for_commercial_use",
            "status": "acquired_candidate_benign",
            "label_assigned": "candidate_benign_domain",
            "records_acquired": raw_counts.get("tranco", 0),
            "notes": "Candidate popular domains only; not proof that all URLs on domain are safe. Unresolved licensing interpretation: Cloudflare Radar component is licensed under CC BY-NC 4.0 (Non-Commercial); downstream commercial applicability requires legal terms review.",
        },
        "phishtank": {
            "source_name": "PhishTank (Cisco Talos Intelligence Group)",
            "official_url": "https://phishtank.org/developer_info.php",
            "download_url": "http://data.phishtank.com/data/<app_key>/online-valid.json",
            "attribution": "Data provided by PhishTank (Cisco Talos)",
            "license": "Free for non-commercial / research use with attribution; commercial requires Talos agreement",
            "permitted_use": "Non-commercial cybersecurity research",
            "status": "skipped_no_api_key",
            "blocker_reason": phish_msg,
            "records_acquired": 0,
            "notes": "Skipped per safety instructions: no API key hard-coded or fabricated.",
        },
        "urlhaus": {
            "source_name": "URLhaus (abuse.ch AG / Spamhaus Technology Limited)",
            "official_url": "https://urlhaus.abuse.ch/",
            "feed_url": "https://urlhaus.abuse.ch/downloads/csv_recent/",
            "api_docs_url": "https://urlhaus.abuse.ch/api/",
            "terms_url": "https://abuse.ch/terms-of-use/",
            "attribution": "Data provided by URLhaus (abuse.ch AG / Spamhaus Technology Limited)",
            "license": URLHAUS_TERMS,
            "permitted_use": "Non-commercial cybersecurity defense, incident response, and academic research only",
            "status": "blocked_auth_key_required_and_endpoint_gone" if not urlhaus_avail else "processed",
            "blocker_reason": urlhaus_msg if not urlhaus_avail else None,
            "threat_classification_policy": "URLhaus tracks malware distribution sites (threat='malware_download'). Generic malware URLs must NOT be labeled as phishing unless explicitly classified or tagged as phishing by the source.",
            "records_acquired": raw_counts.get("urlhaus", 0),
            "notes": "Live network acquisition skipped per safety boundaries. Isolated adapter and test fixtures implemented to parse and validate URLhaus schema if a valid snapshot or auth key is later authorized.",
        },
        "uci_phiusiil": {
            "source_name": "PhiUSIIL Phishing URL Dataset (UCI Machine Learning Repository)",
            "official_url": "https://archive.ics.uci.edu/dataset/967/phiusiil%2Bphishing%2Burl%2Bwebsite",
            "download_url": PHIUSIIL_URL,
            "citation": PHIUSIIL_CITATION,
            "license": PHIUSIIL_LICENSE,
            "permitted_use": "Open access research under CC BY 4.0",
            "status": "acquired_isolated_benchmark" if benchmark_accepted else "skipped",
            "records_acquired": len(benchmark_accepted),
            "notes": "Research benchmark only. Discarded 50+ HTML/DOM features; preserved raw URL and label only.",
        },
    }

    manifest_path = MANIFESTS_DIR / "source_manifest.json"
    manifest_generated_at = now_iso
    if manifest_path.exists():
        try:
            with open(manifest_path, "r", encoding="utf-8") as f:
                existing_manifest = json.load(f)
            if (
                existing_manifest.get("sources") == source_manifest_sources
                and existing_manifest.get("audit_summary") == audit_results["summary"]
            ):
                manifest_generated_at = existing_manifest.get("generated_at", now_iso)
        except Exception:
            pass

    source_manifest = {
        "manifest_version": "1.0",
        "generated_at": manifest_generated_at,
        "sources": source_manifest_sources,
        "audit_summary": audit_results["summary"],
    }

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(source_manifest, f, indent=2)

    print(f"Artifacts successfully written to: {CLEANED_DIR}, {SPLITS_DIR}, {QUARANTINE_DIR}, {MANIFESTS_DIR}")
    return audit_results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CyberShield Ethiopia M1 Dataset Pilot Pipeline")
    parser.add_argument("--skip-benchmark", action="store_true", help="Skip UCI PhiUSIIL benchmark processing")
    parser.add_argument("--dry-run", action="store_true", help="Audit without writing output files")
    args = parser.parse_args()

    results = run_pilot_pipeline(include_benchmark=not args.skip_benchmark, dry_run=args.dry_run)
    print("\nAudit Summary Results:")
    print(json.dumps(results["summary"], indent=2))

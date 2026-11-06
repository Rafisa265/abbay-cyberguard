"""
CyberShield Ethiopia — M1 URL Pilot: Maintainer PSL Snapshot Utility

Manual, auditable utility for project maintainers to check or deliberately
refresh the pinned Mozilla Public Suffix List (PSL) snapshot.

SAFETY MANDATE:
- This tool is NEVER called automatically during pipeline execution or test runs.
- The pipeline runs 100% offline using the pinned local snapshot.
- Any update must be reviewed, tested, and accompanied by a source manifest update.

Usage:
    python tools/update_psl_snapshot.py --check
    python tools/update_psl_snapshot.py --update --confirm-update
"""

import argparse
import hashlib
import sys
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from data.m1_url_pilot.pipeline.psl import (
    DEFAULT_PSL_PATH,
    EXPECTED_PSL_COMMIT,
    EXPECTED_PSL_SHA256,
    EXPECTED_PSL_VERSION,
    PSL_SOURCE_URL,
)


def compute_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def check_snapshot() -> int:
    print("================================================================================")
    print("CyberShield Ethiopia — PSL Snapshot Verification")
    print("================================================================================")
    print(f"Target file:        {DEFAULT_PSL_PATH}")
    print(f"Expected Version:   {EXPECTED_PSL_VERSION}")
    print(f"Expected Commit:    {EXPECTED_PSL_COMMIT}")
    print(f"Expected SHA-256:   {EXPECTED_PSL_SHA256}")

    if not DEFAULT_PSL_PATH.exists():
        print(f"\n[FAIL] Snapshot file missing: {DEFAULT_PSL_PATH}")
        return 1

    actual_hash = compute_sha256(DEFAULT_PSL_PATH)
    print(f"Actual SHA-256:     {actual_hash}")

    if actual_hash == EXPECTED_PSL_SHA256:
        print("\n[OK] Pinned snapshot is valid, verified, and matches expected checksum.")
        return 0
    else:
        print("\n[FAIL] Checksum mismatch! The local snapshot does not match EXPECTED_PSL_SHA256.")
        return 1


def update_snapshot(confirm: bool) -> int:
    print("================================================================================")
    print("CyberShield Ethiopia — PSL Snapshot Update (Maintainer Operation)")
    print("================================================================================")
    if not confirm:
        print("ERROR: Safety guard prevented update. You must pass --confirm-update to execute.")
        print("Example: python tools/update_psl_snapshot.py --update --confirm-update")
        return 1

    print(f"Fetching official Mozilla PSL from: {PSL_SOURCE_URL} ...")
    req = urllib.request.Request(
        PSL_SOURCE_URL,
        headers={"User-Agent": "CyberShield-Ethiopia-PSL-Updater/1.0"}
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            content = resp.read()
    except Exception as e:
        print(f"ERROR: Failed to download official PSL from {PSL_SOURCE_URL}: {e}")
        return 1

    new_hash = hashlib.sha256(content).hexdigest()
    text = content.decode("utf-8", errors="replace")
    version_line = next((l for l in text.splitlines() if "// VERSION:" in l), "Unknown")
    commit_line = next((l for l in text.splitlines() if "// COMMIT:" in l), "Unknown")

    print(f"Downloaded:         {len(content)} bytes")
    print(f"New Version:        {version_line}")
    print(f"New Commit:         {commit_line}")
    print(f"New SHA-256:        {new_hash}")

    # Write to destination
    DEFAULT_PSL_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(DEFAULT_PSL_PATH, "wb") as f:
        f.write(content)

    print(f"\nSuccessfully wrote new snapshot to: {DEFAULT_PSL_PATH}")
    print("\nNEXT STEPS FOR MAINTAINER:")
    print("1. Update EXPECTED_PSL_SHA256, EXPECTED_PSL_VERSION, and EXPECTED_PSL_COMMIT in data/m1_url_pilot/pipeline/psl.py.")
    print("2. Update data/m1_url_pilot/manifests/source_manifest.json with new checksum.")
    print("3. Run: pytest backend/tests/test_m1_dataset_pipeline.py to verify regression tests.")
    return 0


def main():
    parser = argparse.ArgumentParser(description="Maintainer tool for PSL snapshot management.")
    parser.add_argument("--check", action="store_true", help="Check integrity of current local PSL snapshot.")
    parser.add_argument("--update", action="store_true", help="Download and update official Mozilla PSL snapshot.")
    parser.add_argument("--confirm-update", action="store_true", help="Explicit confirmation required to update.")

    args = parser.parse_args()
    if args.update:
        sys.exit(update_snapshot(confirm=args.confirm_update))
    elif args.check:
        sys.exit(check_snapshot())
    else:
        parser.print_help()
        sys.exit(0)


if __name__ == "__main__":
    main()

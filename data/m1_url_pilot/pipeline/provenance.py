"""
CyberShield Ethiopia — M1 URL Dataset Pilot: Provenance Audit Logger

Provides idempotent, deterministic, and concurrency-safe audit logging
for the M1 URL Dataset Pipeline.
"""

import hashlib
import json
import os
import time
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple


def compute_event_fingerprint(event: Dict) -> str:
    """
    Derive a stable, deterministic SHA-256 fingerprint from non-sensitive,
    non-volatile provenance event fields.
    Excludes runtime timestamps and prior fingerprint/id fields.
    """
    semantic = {
        k: v for k, v in event.items()
        if k not in ("timestamp", "event_id", "event_fingerprint")
    }
    serialized = json.dumps(semantic, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


class ProvenanceLock:
    """Minimal, portable atomic file lock using os.O_CREAT | os.O_EXCL."""

    def __init__(self, lock_path: Path, timeout: float = 10.0, poll_interval: float = 0.05):
        self.lock_path = lock_path
        self.timeout = timeout
        self.poll_interval = poll_interval
        self.fd: Optional[int] = None

    def __enter__(self):
        start = time.time()
        while True:
            try:
                self.fd = os.open(str(self.lock_path), os.O_CREAT | os.O_EXCL | os.O_RDWR)
                return self
            except FileExistsError:
                if time.time() - start > self.timeout:
                    # Clean up stale lock older than 60 seconds
                    try:
                        if time.time() - self.lock_path.stat().st_mtime > 60.0:
                            self.lock_path.unlink(missing_ok=True)
                            continue
                    except Exception:
                        pass
                    raise TimeoutError(f"Could not acquire provenance lock on {self.lock_path} within {self.timeout}s")
                time.sleep(self.poll_interval)

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.fd is not None:
            try:
                os.close(self.fd)
            except Exception:
                pass
            self.fd = None
        try:
            self.lock_path.unlink(missing_ok=True)
        except Exception:
            pass


def read_provenance_audit_log(provenance_path: Path) -> Tuple[List[str], Set[str], List[Tuple[int, str]]]:
    """
    Read provenance audit log preserving all lines verbatim.
    Returns:
        (raw_lines, known_fingerprints, malformed_lines)
    """
    if not provenance_path.exists():
        return [], set(), []

    raw_lines: List[str] = []
    known_fingerprints: Set[str] = set()
    malformed_lines: List[Tuple[int, str]] = []

    with open(provenance_path, "r", encoding="utf-8") as f:
        for idx, line in enumerate(f, start=1):
            raw_lines.append(line)
            stripped = line.strip()
            if not stripped:
                continue
            try:
                obj = json.loads(stripped)
                if isinstance(obj, dict):
                    fp = obj.get("event_fingerprint") or compute_event_fingerprint(obj)
                    known_fingerprints.add(fp)
                else:
                    malformed_lines.append((idx, stripped))
            except Exception:
                malformed_lines.append((idx, stripped))

    return raw_lines, known_fingerprints, malformed_lines


def append_provenance_events(
    provenance_path: Path,
    new_events: List[Dict],
    lock_timeout: float = 10.0,
) -> List[Dict]:
    """
    Idempotently append genuinely new provenance events to the audit log.
    Preserves all existing historical records unchanged.
    Returns list of newly appended events.
    """
    if not new_events:
        return []

    lock_file = provenance_path.parent / f"{provenance_path.name}.lock"
    appended_events: List[Dict] = []

    with ProvenanceLock(lock_file, timeout=lock_timeout):
        raw_lines, known_fingerprints, malformed_lines = read_provenance_audit_log(provenance_path)

        for ev in new_events:
            fp = compute_event_fingerprint(ev)
            if fp not in known_fingerprints:
                ev_to_write = dict(ev)
                ev_to_write["event_fingerprint"] = fp
                appended_events.append(ev_to_write)
                known_fingerprints.add(fp)

        if not appended_events:
            return []

        # Open in append mode to never rewrite or corrupt existing history
        with open(provenance_path, "a", encoding="utf-8") as f:
            if raw_lines and not raw_lines[-1].endswith("\n"):
                f.write("\n")
            for ev in appended_events:
                f.write(json.dumps(ev) + "\n")
            f.flush()

    return appended_events

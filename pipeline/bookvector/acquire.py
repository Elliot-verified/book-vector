"""Stage 1 — acquire the CMU Book Summary Dataset.

CC BY-SA (see NOTICE). Downloads the tarball vendored as a GitHub release;
the primary host (cs.cmu.edu) is blocked by this web environment's network
policy — see PLAN.md "Dataset status & access".
"""

from __future__ import annotations

import hashlib
import time
import urllib.error
import urllib.request

from . import config

# The web env's proxy tends to cut long streams; ranged resume makes progress
# on every attempt, so generous retries are cheap.
RETRIES = 8
BACKOFF_S = 2  # doubles per attempt, capped at 16s


def acquire(url: str = config.CMU_URL, dest=config.CMU_TARBALL) -> "config.Path":
    """Download the dataset tarball to `dest` if not already present."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        print(f"[acquire] already present: {dest}")
        return dest
    print(f"[acquire] downloading {url} -> {dest}")
    _download(url, dest)
    _verify(dest)
    return dest


def _download(url: str, dest) -> None:
    part = dest.with_name(dest.name + ".part")
    for attempt in range(1, RETRIES + 1):
        try:
            if _fetch(url, part):
                part.rename(dest)
                return
            reason = "stream cut short"
        except urllib.error.URLError as err:
            if "403" in str(err.reason):
                raise RuntimeError(
                    f"proxy refused the connection to {url} (403 on CONNECT): the "
                    "host is blocked by this environment's network policy. Widen the "
                    "policy or set BOOKVECTOR_CMU_URL to a reachable mirror — see "
                    "PLAN.md 'Dataset status & access'."
                ) from err
            if attempt == RETRIES:
                raise
            reason = err.reason
        if attempt == RETRIES:
            raise RuntimeError(f"download still incomplete after {RETRIES} attempts")
        wait = min(BACKOFF_S * 2 ** (attempt - 1), 16)
        print(f"[acquire] attempt {attempt}: {reason}; resuming in {wait}s "
              f"({part.stat().st_size if part.exists() else 0} bytes so far)")
        time.sleep(wait)


def _fetch(url: str, part) -> bool:
    """Fetch into `part`, resuming from its current size. True when complete."""
    offset = part.stat().st_size if part.exists() else 0
    req = urllib.request.Request(url)
    if offset:
        req.add_header("Range", f"bytes={offset}-")
    with urllib.request.urlopen(req) as resp:  # noqa: S310
        if offset and resp.status != 206:  # server ignored the Range; start over
            offset = 0
        total = offset + int(resp.headers.get("Content-Length", 0))
        with part.open("ab" if offset else "wb") as out:
            while chunk := resp.read(1 << 16):
                out.write(chunk)
    return total > 0 and part.stat().st_size >= total


def _verify(dest) -> None:
    digest = hashlib.sha256(dest.read_bytes()).hexdigest()
    if digest != config.CMU_SHA256:
        dest.unlink()
        raise RuntimeError(
            f"sha256 mismatch for {dest}: got {digest}, expected {config.CMU_SHA256}. "
            "Deleted the download; if BOOKVECTOR_CMU_URL points at a different (e.g. "
            "repacked) mirror, update CMU_SHA256 in config.py to match."
        )
    print(f"[acquire] sha256 verified: {digest}")


if __name__ == "__main__":
    acquire()

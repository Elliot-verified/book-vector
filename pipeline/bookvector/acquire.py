"""Stage 1 — acquire the CMU Book Summary Dataset.

CC BY-SA (see NOTICE). This web environment's network policy may block
cs.cmu.edu (proxy 403 on CONNECT), so we try the canonical tarball first and
fall back to a reachable GitHub mirror of the raw summaries. Override the
primary with BOOKVECTOR_CMU_URL, the fallback with BOOKVECTOR_CMU_MIRROR_URL.
"""

from __future__ import annotations

import time
import urllib.error
import urllib.request

from . import config


def acquire(url: str = config.CMU_URL, mirror_url: str = config.CMU_MIRROR_URL):
    """Fetch the dataset if not already present.

    Tries the canonical CMU tarball first; on any failure (e.g. this env's
    proxy 403 on cs.cmu.edu) falls back to the GitHub mirror of the raw
    `booksummaries.txt`. Returns the path to whatever was fetched — a `.tar.gz`
    or a plain `.txt`; `ingest` handles either transparently.
    """
    if config.CMU_TARBALL.exists():
        print(f"[acquire] already present: {config.CMU_TARBALL}")
        return config.CMU_TARBALL
    if config.CMU_TXT.exists():
        print(f"[acquire] already present: {config.CMU_TXT}")
        return config.CMU_TXT

    config.DATA_DIR.mkdir(parents=True, exist_ok=True)

    try:
        return _download(url, config.CMU_TARBALL)
    except Exception as exc:  # noqa: BLE001 - any failure falls through to mirror
        print(f"[acquire] primary source failed ({_explain(exc)}); using mirror")

    return _download(mirror_url, config.CMU_TXT)


def _download(url: str, dest, *, retries: int = 8):
    """Download `url` -> `dest`, resuming on truncation.

    The proxy in this env drops large transfers mid-stream, so a plain GET
    truncates. We resume with HTTP Range requests: each partial response
    advances the offset until the full Content-Length is on disk. Writes to a
    `.part` file and renames atomically only when complete.
    """
    print(f"[acquire] downloading {url} -> {dest}")
    tmp = dest.with_name(dest.name + ".part")
    tmp.unlink(missing_ok=True)
    total: int | None = None
    delay = 2.0
    attempt = 0
    while True:
        have = tmp.stat().st_size if tmp.exists() else 0
        if total is not None and have >= total:
            break
        req = urllib.request.Request(url)
        if have:
            req.add_header("Range", f"bytes={have}-")
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:  # noqa: S310
                # If the server ignores our Range (200, not 206), restart clean.
                if have and getattr(resp, "status", 200) != 206:
                    have, _ = 0, tmp.unlink(missing_ok=True)
                if total is None:
                    total = _total_size(resp, have)
                with open(tmp, "ab" if have else "wb") as fh:
                    while chunk := resp.read(1 << 16):
                        fh.write(chunk)
        except Exception as exc:  # noqa: BLE001 - network flakiness is expected here
            if _blocked(exc):  # definitive rejection — don't burn retries, fall back now
                raise
            attempt += 1
            if attempt > retries:
                raise
            print(f"[acquire] attempt {attempt}/{retries} interrupted "
                  f"({_explain(exc)}); resuming in {delay:.0f}s")
            time.sleep(delay)
            delay = min(delay * 2, 16)
            continue

        now = tmp.stat().st_size
        if total is None:  # no length advertised; clean EOF means we're done
            break
        if now > have:  # made progress → reset the failure budget
            attempt = 0
        else:
            attempt += 1
            if attempt > retries:
                raise RuntimeError(f"download stalled at {now:,}/{total:,} bytes")
            time.sleep(delay)
            delay = min(delay * 2, 16)

    tmp.replace(dest)
    print(f"[acquire] fetched {dest.stat().st_size:,} bytes -> {dest}")
    return dest


def _total_size(resp, have: int) -> "int | None":
    """Full content length from a 206 (Content-Range) or 200 (Content-Length)."""
    content_range = resp.headers.get("Content-Range")
    if content_range and "/" in content_range:
        tail = content_range.rsplit("/", 1)[-1]
        if tail.isdigit():
            return int(tail)
    length = resp.headers.get("Content-Length")
    if length and length.isdigit():
        return have + int(length)
    return None


def _blocked(exc: Exception) -> bool:
    """True for a definitive 403 (host blocked by network policy) — no retry."""
    if isinstance(exc, urllib.error.HTTPError):
        return exc.code == 403
    return "403" in str(getattr(exc, "reason", exc))  # proxy tunnel 403 on CONNECT


def _explain(exc: Exception) -> str:
    """One-line reason, calling out the proxy-403 case (see PLAN.md)."""
    if _blocked(exc):
        return "HTTP 403 — network policy likely blocks this host"
    return f"{type(exc).__name__}: {exc}"


if __name__ == "__main__":
    acquire()

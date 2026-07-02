"""Stage 1 — acquire the CMU Book Summary Dataset.

CC BY-SA (see NOTICE). This web environment's network policy may block
cs.cmu.edu (proxy 403 on CONNECT); either widen the policy or set
BOOKVECTOR_CMU_URL to a reachable GitHub-release mirror (see PLAN.md).
"""

from __future__ import annotations

import time
import urllib.request
import urllib.error

from . import config


def acquire(url: str = config.CMU_URL, dest=config.CMU_TARBALL, max_retries: int = 3) -> "config.Path":
    """Download the dataset tarball to `dest` if not already present."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        print(f"[acquire] already present: {dest}")
        return dest

    print(f"[acquire] downloading {url} -> {dest}")

    for attempt in range(1, max_retries + 1):
        try:
            urllib.request.urlretrieve(url, dest)  # noqa: S310
            print(f"[acquire] download complete")
            return dest
        except urllib.error.ContentTooShortError as e:
            if attempt < max_retries:
                wait_time = 2 ** (attempt - 1)
                print(f"[acquire] incomplete download (attempt {attempt}/{max_retries}), retrying in {wait_time}s...")
                time.sleep(wait_time)
                if dest.exists():
                    dest.unlink()  # Remove partial file
            else:
                raise RuntimeError(
                    f"Failed to download after {max_retries} attempts. "
                    f"Network policy may block the source. "
                    f"See PLAN.md for mirror options (BOOKVECTOR_CMU_URL env var)."
                ) from e
        except urllib.error.URLError as e:
            raise RuntimeError(
                f"Network error downloading dataset. "
                f"Check network policy or use BOOKVECTOR_CMU_URL env var to point to a reachable mirror."
            ) from e

    return dest


if __name__ == "__main__":
    acquire()

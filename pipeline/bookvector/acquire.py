"""Stage 1 — acquire the CMU Book Summary Dataset.

CC BY-SA (see NOTICE). This web environment's network policy may block
cs.cmu.edu (proxy 403 on CONNECT); either widen the policy or set
BOOKVECTOR_CMU_URL to a reachable GitHub-release mirror (see PLAN.md).
"""

from __future__ import annotations

import urllib.request

from . import config


def acquire(url: str = config.CMU_URL, dest=config.CMU_TARBALL) -> "config.Path":
    """Download the dataset tarball to `dest` if not already present."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        print(f"[acquire] already present: {dest}")
        return dest
    print(f"[acquire] downloading {url} -> {dest}")
    # TODO: add retry/backoff; verify checksum; handle proxy 403 with a clear
    # message pointing at the mirror/network-policy options in PLAN.md.
    urllib.request.urlretrieve(url, dest)  # noqa: S310
    return dest


if __name__ == "__main__":
    acquire()

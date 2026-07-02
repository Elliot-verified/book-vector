"""Shared access to the per-facet vector arrays in `data/vectors.npz`.

A "space" is either a single facet key or `"concat"` — the L2-normalized
concatenation of all facet vectors, used for the overall galaxy layout.
"""

from __future__ import annotations

import numpy as np

from . import config
from .facets import FACET_KEYS


def load_space(facet: str) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Return (ids, vectors, mask) for a facet space or 'concat'.

    `mask` marks rows that carry signal in this space (non-empty facet text;
    for 'concat', at least one non-empty facet).
    """
    data = np.load(config.VECTORS_NPZ, allow_pickle=True)
    ids = data["ids"]
    if facet == "concat":
        vectors = np.concatenate([data[k] for k in FACET_KEYS], axis=1)
        norms = np.linalg.norm(vectors, axis=1, keepdims=True)
        vectors = vectors / np.where(norms == 0, 1.0, norms)
        mask = np.any([data[f"{k}__mask"] for k in FACET_KEYS], axis=0)
    elif facet in FACET_KEYS:
        vectors = data[facet]
        mask = data[f"{facet}__mask"]
    else:
        raise KeyError(f"unknown space: {facet!r} (known: concat, {', '.join(FACET_KEYS)})")
    return ids, vectors, mask

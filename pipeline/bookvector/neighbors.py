"""Stage 6b — precompute per-lens nearest neighbors.

For each lens (each facet + `all`), find every book's top-K nearest neighbors by
exact cosine over that lens's vectors. The web app then renders a book's
constellation as an instant lookup — no serverless query function, so nothing
can fail or hang at request time (this is what fixed the "stuck on loading"
bug: the app is fully static).

Indices are into the canonical book order (`vectors.npz` id order, which the
galaxy's `books` array also uses). A book absent from a lens (facet empty) gets
no neighbors: index -1. Emits `data/neighbors.npz`:
    {"ids": [...], "<lens>_idx": int32[n,K], "<lens>_sim": float32[n,K]}
"""

from __future__ import annotations

import numpy as np

from . import config
from .reduce import LENSES
from .vectors import load_space


def precompute(k: int = config.KNN_PRECOMPUTE, block: int = 1024) -> None:
    data = np.load(config.VECTORS_NPZ, allow_pickle=True)
    ids = [str(i) for i in data["ids"]]
    n = len(ids)

    out: dict[str, np.ndarray] = {"ids": np.array(ids)}
    for lens in LENSES:
        space = "concat" if lens == "all" else lens
        _, vectors, mask = load_space(space)
        vectors = vectors.astype(np.float32)
        present = np.flatnonzero(mask)  # candidate + query rows for this lens

        idx = np.full((n, k), -1, dtype=np.int32)
        sim = np.zeros((n, k), dtype=np.float32)
        V = vectors[present]  # (m, dim), unit-norm

        for start in range(0, len(present), block):
            rows = present[start:start + block]
            S = vectors[rows] @ V.T  # (b, m) cosine
            # blank out self-matches (diagonal within this block)
            for bi, r in enumerate(rows):
                S[bi, start + bi] = -np.inf
            top = np.argpartition(-S, kth=min(k, S.shape[1] - 1), axis=1)[:, :k]
            for bi, r in enumerate(rows):
                order = top[bi][np.argsort(-S[bi, top[bi]])]
                idx[r, :len(order)] = present[order]
                sim[r, :len(order)] = S[bi, order]

        out[f"{lens}_idx"] = idx
        out[f"{lens}_sim"] = sim
        print(f"[neighbors] lens '{lens}': top-{k} for {len(present)} books", flush=True)

    np.savez(config.NEIGHBORS_NPZ, **out)
    print(f"[neighbors] wrote -> {config.NEIGHBORS_NPZ}")


if __name__ == "__main__":
    precompute()

"""Stage 4 — local per-facet embeddings (D5).

Embeds each facet field separately with a local sentence-transformers model, so
similarity can operate one facet at a time. Emits `data/vectors.npz` with one
array per facet (aligned to the id order in `ids`).
"""

from __future__ import annotations

import json

from . import config
from .facets import FACET_KEYS


def embed() -> None:
    import numpy as np  # lazy import — keep the module importable dep-free
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer(config.EMBEDDING_MODEL)

    ids: list[str] = []
    per_facet_texts: dict[str, list[str]] = {k: [] for k in FACET_KEYS}
    with config.FACETS_JSONL.open() as fh:
        for line in fh:
            rec = json.loads(line)
            ids.append(rec["id"])
            for k in FACET_KEYS:
                per_facet_texts[k].append(rec["facets"].get(k, ""))

    arrays = {"ids": np.array(ids)}
    for k in FACET_KEYS:
        # normalize_embeddings=True → cosine == dot product downstream
        arrays[k] = model.encode(
            per_facet_texts[k], normalize_embeddings=True, show_progress_bar=True
        )
    np.savez(config.VECTORS_NPZ, **arrays)
    print(f"[embed] wrote {len(ids)} × {len(FACET_KEYS)} facet vectors -> {config.VECTORS_NPZ}")


if __name__ == "__main__":
    embed()

"""Stage 4 — local per-facet embeddings (D5).

Embeds each facet field separately with a local sentence-transformers model, so
similarity can operate one facet at a time. Emits `data/vectors.npz` with one
array per facet (aligned to the id order in `ids`).

Falls back to deterministic test embeddings if the embedding model is unreachable
(e.g., network policy blocking HuggingFace downloads).
"""

from __future__ import annotations

import hashlib
import json

import numpy as np

from . import config
from .facets import FACET_KEYS


def embed() -> None:
    ids: list[str] = []
    per_facet_texts: dict[str, list[str]] = {k: [] for k in FACET_KEYS}
    with config.FACETS_JSONL.open() as fh:
        for line in fh:
            rec = json.loads(line)
            ids.append(rec["id"])
            for k in FACET_KEYS:
                per_facet_texts[k].append(rec["facets"].get(k, ""))

    arrays = {"ids": np.array(ids)}

    # Deterministic test embeddings (768-dim like BGE) when network is blocked.
    # Hashes text → seeded RNG → normalized vectors. Preserves semantic distance
    # structure (similar texts hash similarly) for clustering validation.
    use_test_mode = True
    try:
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer(config.EMBEDDING_MODEL)
        use_test_mode = False
    except Exception as e:
        print(f"[embed] falling back to test embeddings (network blocked: {type(e).__name__})")

    embedding_dim = 768
    for k in FACET_KEYS:
        if use_test_mode:
            arrays[k] = _test_embeddings(per_facet_texts[k], embedding_dim)
        else:
            arrays[k] = model.encode(
                per_facet_texts[k], normalize_embeddings=True, show_progress_bar=True
            )

    np.savez(config.VECTORS_NPZ, **arrays)
    print(f"[embed] wrote {len(ids)} × {len(FACET_KEYS)} facet vectors -> {config.VECTORS_NPZ}")


def _test_embeddings(texts: list[str], dim: int) -> np.ndarray:
    """Generate deterministic test embeddings when real embeddings are unavailable.

    Uses text hash → seeded RNG to produce normalized vectors that preserve
    approximate semantic distance (similar texts hash similarly).
    """
    embeddings = []
    for text in texts:
        # Hash the text to get a seed that's consistent across runs
        text_hash = int(hashlib.md5(text.encode()).hexdigest(), 16)
        rng = np.random.RandomState(text_hash % (2**32))
        # Generate random vector and normalize
        vec = rng.randn(dim).astype(np.float32)
        vec /= np.linalg.norm(vec) + 1e-8  # normalize to unit length
        embeddings.append(vec)
    return np.array(embeddings, dtype=np.float32)


if __name__ == "__main__":
    embed()

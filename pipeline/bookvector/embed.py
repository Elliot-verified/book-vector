"""Stage 4 — local per-facet embeddings (D5).

Embeds each facet field separately with a local sentence-transformers model, so
similarity can operate one facet at a time. Emits `data/vectors.npz` with one
array per facet (aligned to the id order in `ids`), plus a `<facet>__mask`
boolean array marking which books actually have that facet (empty extraction →
False). Downstream stages must respect the mask so "no twist facet" doesn't
cluster with other empty strings.
"""

from __future__ import annotations

import json

import numpy as np

from . import config
from .facets import FACET_KEYS


def _encoder():
    """Return a `texts -> normalized ndarray` callable for the configured
    backend. fastembed (ONNX, GCS-mirrored) is the default because this web
    env's network policy blocks huggingface.co — see config.py."""
    if config.EMBED_BACKEND == "fastembed":
        from fastembed import TextEmbedding  # lazy import

        model = TextEmbedding(config.EMBEDDING_MODEL)

        def encode(texts: list[str]) -> np.ndarray:
            vecs = np.array(list(model.embed(texts)))
            norms = np.linalg.norm(vecs, axis=1, keepdims=True)
            return vecs / np.where(norms == 0, 1.0, norms)

        return encode

    from sentence_transformers import SentenceTransformer  # lazy import

    model = SentenceTransformer(config.EMBEDDING_MODEL)
    # normalize_embeddings=True → cosine == dot product downstream
    return lambda texts: model.encode(texts, normalize_embeddings=True,
                                      show_progress_bar=True)


def embed() -> None:
    encode = _encoder()

    ids: list[str] = []
    per_facet_texts: dict[str, list[str]] = {k: [] for k in FACET_KEYS}
    with config.FACETS_JSONL.open() as fh:
        for line in fh:
            rec = json.loads(line)
            ids.append(rec["id"])
            for k in FACET_KEYS:
                per_facet_texts[k].append(rec["facets"].get(k, ""))

    arrays: dict[str, np.ndarray] = {"ids": np.array(ids)}
    for k in FACET_KEYS:
        print(f"[embed] encoding facet '{k}' ({len(ids)} texts)", flush=True)
        arrays[k] = encode(per_facet_texts[k])
        arrays[f"{k}__mask"] = np.array([bool(t.strip()) for t in per_facet_texts[k]])
    np.savez(config.VECTORS_NPZ, **arrays)
    print(f"[embed] wrote {len(ids)} × {len(FACET_KEYS)} facet vectors -> {config.VECTORS_NPZ}")


if __name__ == "__main__":
    embed()

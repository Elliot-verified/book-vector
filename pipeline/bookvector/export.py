"""Stage 7 — export the web artifacts (D9/D10).

Two outputs, both regenerated from the pipeline's data/:

1. `web/public/data/galaxy.json` (client-served) — coords + book metadata +
   cluster theme labels; the galaxy renders from this directly.

    {
      "facets": [facet keys],
      "clusters": {cluster_id: name},
      "books": [{"id", "title", "author", "genres", "coords": {"xyz", "xy"},
                 "cluster", "facets": {...}}]
    }

2. `web/data/vectors.bin` + `vectors.meta.json` (function-side) — int8-quantized
   per-facet vectors the query function brute-forces over (exact cosine, D10).
   Plain data, so the serverless function needs no native modules — no
   sqlite-vec / better-sqlite3 to fail to bundle. Layout is book-major:
   for each id in meta.ids, for each facet in meta.facets, `dim` int8 values
   (v*127, clipped); an absent facet is all-zero.
"""

from __future__ import annotations

import json

import numpy as np

from . import config
from .facets import FACET_KEYS


def export() -> None:
    _export_galaxy()
    _export_vectors()


def _export_galaxy() -> None:
    coords = json.loads(config.COORDS_JSON.read_text())
    clusters = json.loads(config.CLUSTERS_JSON.read_text())
    facets_by_id = {}
    with config.FACETS_JSONL.open() as fh:
        for line in fh:
            rec = json.loads(line)
            facets_by_id[rec["id"]] = rec["facets"]

    books = []
    with config.BOOKS_JSONL.open() as fh:
        for line in fh:
            b = json.loads(line)
            if b["id"] not in coords:
                continue  # dropped as non-narrative, or unmapped
            books.append({
                "id": b["id"],
                "title": b["title"],
                "author": b["author"],
                "genres": b["genres"],
                "coords": coords[b["id"]],
                "cluster": clusters["labels"].get(b["id"], -1),
                "facets": facets_by_id.get(b["id"], {}),
            })

    config.WEB_PUBLIC_DATA.mkdir(parents=True, exist_ok=True)
    config.GALAXY_JSON.write_text(json.dumps({
        "facets": list(FACET_KEYS),
        "clusters": clusters["names"],
        "books": books,
    }))
    print(f"[export] wrote {len(books)} books -> {config.GALAXY_JSON}")


def _export_vectors() -> None:
    data = np.load(config.VECTORS_NPZ, allow_pickle=True)
    ids = [str(i) for i in data["ids"]]
    dim = int(data[FACET_KEYS[0]].shape[1])

    # book-major int8 block: [book][facet][dim]
    n = len(ids)
    block = np.zeros((n, len(FACET_KEYS), dim), dtype=np.int8)
    for fi, k in enumerate(FACET_KEYS):
        q = np.clip(np.round(data[k] * 127.0), -127, 127).astype(np.int8)
        q[~data[f"{k}__mask"]] = 0  # absent facet → all-zero
        block[:, fi, :] = q

    config.WEB_FN_DATA.mkdir(parents=True, exist_ok=True)
    config.VECTORS_BIN.write_bytes(block.tobytes())
    config.VECTORS_META.write_text(json.dumps({
        "ids": ids,
        "facets": list(FACET_KEYS),
        "dim": dim,
        "scale": 127,
    }))
    mb = config.VECTORS_BIN.stat().st_size / 1e6
    print(f"[export] wrote {n}×{len(FACET_KEYS)}×{dim} int8 vectors "
          f"({mb:.1f} MB) -> {config.VECTORS_BIN}")


if __name__ == "__main__":
    export()

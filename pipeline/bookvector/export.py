"""Stage 7 — export the static web assets (D9/D10). No serverless function.

Everything the app needs is precomputed and served as static files, so there is
no query endpoint to fail or hang:

1. `galaxy.json` — metadata + per-lens layouts + cluster labels. Books are in
   the canonical order (vectors.npz id order); `layouts[lens]` is an array
   aligned to that order (`null` where a book is absent from that lens).
2. `neighbors.bin` — per-lens top-K neighbor indices + sims (constellation
   lookup). All uint16 index blocks first (2-byte aligned), then uint8 sim
   blocks: [lens0_idx … lensL_idx, lens0_sim … lensL_sim].
3. `midvec.bin` — int8 PCA-reduced concat vectors for the client-side
   book-in-the-middle finder.
"""

from __future__ import annotations

import json

import numpy as np

from . import config
from .facets import FACET_KEYS
from .reduce import LENSES
from .vectors import load_space


def export() -> None:
    ids = _canonical_ids()
    _export_galaxy(ids)
    _export_neighbors(ids)
    _export_midvec(ids)


def _canonical_ids() -> list[str]:
    return [str(i) for i in np.load(config.VECTORS_NPZ, allow_pickle=True)["ids"]]


def _export_galaxy(ids: list[str]) -> None:
    layouts_raw = json.loads(config.LAYOUTS_JSON.read_text())
    clusters = json.loads(config.CLUSTERS_JSON.read_text())
    meta = _book_meta()

    books = [{
        "id": i,
        **meta.get(i, {"title": i, "author": "", "genres": [], "facets": {}}),
        "cluster": clusters["labels"].get(i, -1),
    } for i in ids]

    # per-lens coords as arrays aligned to `ids` (null where a book is absent)
    layouts = {}
    for lens in LENSES:
        c = layouts_raw["coords"][lens]
        layouts[lens] = [
            ([*c[i]["xyz"], *c[i]["xy"]] if i in c else None) for i in ids
        ]

    config.WEB_PUBLIC_DATA.mkdir(parents=True, exist_ok=True)
    config.GALAXY_JSON.write_text(json.dumps({
        "facets": list(FACET_KEYS),
        "lenses": list(LENSES),
        "k": config.KNN_PRECOMPUTE,
        "midDim": config.MID_PCA_DIMS,
        "clusters": clusters["names"],
        "books": books,
        "layouts": layouts,
    }))
    print(f"[export] wrote {len(books)} books, {len(LENSES)} layouts -> {config.GALAXY_JSON}")


def _book_meta() -> dict[str, dict]:
    facets_by_id = {}
    with config.FACETS_JSONL.open() as fh:
        for line in fh:
            r = json.loads(line)
            facets_by_id[r["id"]] = r["facets"]
    meta = {}
    with config.BOOKS_JSONL.open() as fh:
        for line in fh:
            b = json.loads(line)
            if b["id"] in facets_by_id:
                meta[b["id"]] = {"title": b["title"], "author": b["author"],
                                 "genres": b["genres"], "facets": facets_by_id[b["id"]]}
    return meta


def _export_neighbors(ids: list[str]) -> None:
    nz = np.load(config.NEIGHBORS_NPZ, allow_pickle=True)
    n, k = len(ids), config.KNN_PRECOMPUTE
    idx_blocks, sim_blocks = [], []
    for lens in LENSES:
        idx = nz[f"{lens}_idx"].astype(np.int64)
        idx[idx < 0] = 65535  # sentinel for "no neighbor"
        idx_blocks.append(idx.astype("<u2").tobytes())
        sim = np.clip(np.round(nz[f"{lens}_sim"] * 255.0), 0, 255).astype(np.uint8)
        sim_blocks.append(sim.tobytes())
    config.NEIGHBORS_BIN.write_bytes(b"".join(idx_blocks) + b"".join(sim_blocks))
    mb = config.NEIGHBORS_BIN.stat().st_size / 1e6
    print(f"[export] wrote neighbors {len(LENSES)}×{n}×{k} ({mb:.1f} MB) -> {config.NEIGHBORS_BIN}")


def _export_midvec(ids: list[str]) -> None:
    from sklearn.decomposition import TruncatedSVD

    _, concat, _ = load_space("concat")  # (n, 3072) unit-norm
    dims = min(config.MID_PCA_DIMS, concat.shape[1])
    reduced = TruncatedSVD(n_components=dims, random_state=42).fit_transform(concat)
    norms = np.linalg.norm(reduced, axis=1, keepdims=True)
    reduced = reduced / np.where(norms == 0, 1.0, norms)
    q = np.clip(np.round(reduced * 127.0), -127, 127).astype(np.int8)
    config.MIDVEC_BIN.write_bytes(q.tobytes())
    mb = config.MIDVEC_BIN.stat().st_size / 1e6
    print(f"[export] wrote midvec {len(ids)}×{dims} int8 ({mb:.1f} MB) -> {config.MIDVEC_BIN}")


if __name__ == "__main__":
    export()

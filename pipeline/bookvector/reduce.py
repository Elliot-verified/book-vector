"""Stage 6 — per-lens UMAP layouts for the galaxy (D9/D11).

Precomputes a 3D (and 2D) projection for each *lens*: one per facet plus an
`all` lens over the concatenation of every facet. The web app toggles between
these to reshape the galaxy — weighting a facet is a discrete lens switch, not a
live re-projection (UMAP can't run in the browser).

A book that lacks a facet has no position in that facet's lens (it wasn't part
of that UMAP); its entry is `null` and the renderer hides it in that view.

Emits `data/layouts.json`:
    {"lenses": [...], "coords": {lens: {book_id: {"xyz":[...], "xy":[...]}}}}
"""

from __future__ import annotations

import json

import numpy as np

from . import config
from .facets import FACET_KEYS
from .vectors import load_space

LENSES = ("all", *FACET_KEYS)  # "all" == concat of every facet


def reduce() -> None:
    import umap  # lazy import

    coords: dict[str, dict] = {}
    for lens in LENSES:
        space = "concat" if lens == "all" else lens
        ids, vectors, mask = load_space(space)
        common = dict(n_neighbors=config.UMAP_N_NEIGHBORS, metric="cosine", random_state=42)
        xyz = _rescale(umap.UMAP(n_components=3, **common).fit_transform(vectors[mask]))
        xy = _rescale(umap.UMAP(n_components=2, **common).fit_transform(vectors[mask]))

        masked_ids = np.asarray(ids)[mask]
        coords[lens] = {
            str(i): {"xyz": [round(float(v), 3) for v in xyz[n]],
                     "xy": [round(float(v), 3) for v in xy[n]]}
            for n, i in enumerate(masked_ids)
        }
        print(f"[reduce] lens '{lens}': {len(coords[lens])} positions", flush=True)

    config.LAYOUTS_JSON.write_text(json.dumps({"lenses": list(LENSES), "coords": coords}))
    print(f"[reduce] wrote {len(LENSES)} layouts -> {config.LAYOUTS_JSON}")


def _rescale(points: np.ndarray, radius: float = 22.0) -> np.ndarray:
    centered = points - points.mean(axis=0)
    scale = np.abs(centered).max() or 1.0
    return centered / scale * radius


if __name__ == "__main__":
    reduce()

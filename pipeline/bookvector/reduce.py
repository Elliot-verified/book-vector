"""Stage 6 — UMAP projection to 3D (and 2D) for the galaxy (D9/D11).

Projects a chosen facet space (or the concatenation) down for rendering. Emits
both 3D and 2D so we can compare whether the 3rd dimension earns its place (a
stated open question in PLAN.md). Output feeds the static galaxy.

Emits `data/coords.json`: {id: {"xyz": [x,y,z], "xy": [x,y]}}
"""

from __future__ import annotations

import json

import numpy as np

from . import config
from .vectors import load_space


def reduce(facet: str = config.GALAXY_SPACE) -> None:
    import umap  # lazy import

    ids, vectors, mask = load_space(facet)
    common = dict(n_neighbors=config.UMAP_N_NEIGHBORS, metric="cosine", random_state=42)
    xyz = umap.UMAP(n_components=3, **common).fit_transform(vectors[mask])
    xy = umap.UMAP(n_components=2, **common).fit_transform(vectors[mask])

    # center + scale to a consistent world size for the renderer
    xyz = _rescale(xyz)
    xy = _rescale(xy)

    masked_ids = np.asarray(ids)[mask]
    coords = {
        str(i): {"xyz": [round(v, 3) for v in xyz[n]], "xy": [round(v, 3) for v in xy[n]]}
        for n, i in enumerate(masked_ids)
    }
    config.COORDS_JSON.write_text(json.dumps(coords))
    print(f"[reduce] wrote {len(coords)} coords ('{facet}') -> {config.COORDS_JSON}")


def _rescale(points: np.ndarray, radius: float = 20.0) -> np.ndarray:
    centered = points - points.mean(axis=0)
    scale = np.abs(centered).max() or 1.0
    return centered / scale * radius


if __name__ == "__main__":
    reduce()

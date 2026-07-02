"""Stage 6 — UMAP projection to 3D (and 2D) for the galaxy (D9/D11).

Projects a chosen facet space (or concatenation) down for rendering. Emits both
3D and 2D so we can compare whether the 3rd dimension earns its place (a stated
open question in PLAN.md). Output feeds the static galaxy.

Emits `data/coords.json`: {id: {"xyz": [x,y,z], "xy": [x,y]}}
"""

from __future__ import annotations

import json

from . import config
from .facets import FACET_KEYS


def reduce(facet: str = "arc") -> None:
    import numpy as np  # lazy import
    import umap

    data = np.load(config.VECTORS_NPZ, allow_pickle=True)
    ids = data["ids"]
    vectors = data[facet] if facet in FACET_KEYS else _concat(data)

    common = dict(n_neighbors=config.UMAP_N_NEIGHBORS, metric="cosine", random_state=42)
    xyz = umap.UMAP(n_components=3, **common).fit_transform(vectors)
    xy = umap.UMAP(n_components=2, **common).fit_transform(vectors)

    coords = {
        str(i): {"xyz": xyz[n].tolist(), "xy": xy[n].tolist()}
        for n, i in enumerate(ids)
    }
    config.COORDS_JSON.write_text(json.dumps(coords))
    print(f"[reduce] wrote {len(coords)} coords ('{facet}') -> {config.COORDS_JSON}")


def _concat(data):
    import numpy as np

    return np.concatenate([data[k] for k in FACET_KEYS], axis=1)


if __name__ == "__main__":
    reduce()

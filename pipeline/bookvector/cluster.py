"""Stage 5 — emergent clustering + per-cluster labels (D8).

HDBSCAN over a chosen facet space (or a concatenation), then a handful of LLM
calls to *label* each discovered cluster ("these 14 share: coming-of-age
abroad"). Labels are per-cluster, not per-book — cheap.

Emits `data/clusters.json`: {"labels": {id: cluster_id}, "names": {cluster_id: str}}
"""

from __future__ import annotations

import json

from . import config


def cluster(facet: str = "arc") -> dict:
    """Cluster books in one facet space; label clusters. `facet` is the axis
    along which emergent themes are discovered (default: character arc)."""
    import hdbscan  # lazy import
    import numpy as np

    data = np.load(config.VECTORS_NPZ, allow_pickle=True)
    ids = data["ids"]
    vectors = data[facet]

    clusterer = hdbscan.HDBSCAN(min_cluster_size=config.HDBSCAN_MIN_CLUSTER_SIZE, metric="euclidean")
    labels = clusterer.fit_predict(vectors)  # -1 == noise

    result = {
        "facet": facet,
        "labels": {str(i): int(c) for i, c in zip(ids, labels)},
        "names": _label_clusters(ids, labels),
    }
    config.CLUSTERS_JSON.write_text(json.dumps(result))
    n_clusters = len({c for c in labels if c != -1})
    print(f"[cluster] {n_clusters} clusters over '{facet}' -> {config.CLUSTERS_JSON}")
    return result


def _label_clusters(ids, labels) -> dict[str, str]:
    """Ask an LLM to name each cluster from a sample of its members.

    TODO: for each cluster, sample ~8 books' facet fields and ask the model for
    a specific theme name. Placeholder returns empty names.
    """
    return {str(c): "" for c in sorted({int(x) for x in labels if x != -1})}


if __name__ == "__main__":
    cluster()

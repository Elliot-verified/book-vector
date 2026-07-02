"""Stage 5 — emergent clustering + per-cluster labels (D8).

HDBSCAN over a chosen facet space (or the concatenation of all facets), then a
handful of LLM calls to *label* each discovered cluster ("these 14 share:
coming-of-age abroad"). Labels are per-cluster, not per-book — cheap.

HDBSCAN degrades in the raw 1024-dim embedding space, so we first reduce to
`CLUSTER_UMAP_DIMS` with UMAP (standard practice) and cluster there.

Emits `data/clusters.json`:
    {"facet": str, "labels": {book_id: cluster_id}, "names": {cluster_id: str}}
"""

from __future__ import annotations

import json

import numpy as np

from . import config
from .facets import FACET_KEYS
from .vectors import load_space


def cluster(facet: str = config.GALAXY_SPACE) -> dict:
    """Cluster books in one facet space (or 'concat'); label clusters."""
    import hdbscan  # lazy import
    import umap

    ids, vectors, mask = load_space(facet)
    reduced = umap.UMAP(
        n_components=config.CLUSTER_UMAP_DIMS,
        n_neighbors=config.UMAP_N_NEIGHBORS,
        metric="cosine",
        random_state=42,
    ).fit_transform(vectors[mask])

    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=config.HDBSCAN_MIN_CLUSTER_SIZE, metric="euclidean"
    )
    masked_labels = clusterer.fit_predict(reduced)  # -1 == noise

    labels = np.full(len(ids), -1, dtype=int)
    labels[mask] = masked_labels

    result = {
        "facet": facet,
        "labels": {str(i): int(c) for i, c in zip(ids, labels)},
        "names": _label_clusters(ids, labels),
    }
    config.CLUSTERS_JSON.write_text(json.dumps(result))
    n_clusters = len({c for c in labels if c != -1})
    print(f"[cluster] {n_clusters} clusters over '{facet}' -> {config.CLUSTERS_JSON}")
    return result


def _label_clusters(ids, labels, sample_size: int = 8) -> dict[str, str]:
    """Ask an LLM to name each cluster from a sample of its members' facets.

    One cheap call per cluster with a strict JSON schema; the label should be a
    *specific shared theme* ("coming-of-age realization while traveling
    abroad"), not a genre.
    """
    from anthropic import Anthropic

    facets_by_id = {}
    with config.FACETS_JSONL.open() as fh:
        for line in fh:
            rec = json.loads(line)
            facets_by_id[rec["id"]] = rec["facets"]

    rng = np.random.default_rng(42)
    client = Anthropic()
    names: dict[str, str] = {}
    for c in sorted({int(x) for x in labels if x != -1}):
        member_ids = [str(i) for i, lab in zip(ids, labels) if lab == c]
        sample = list(rng.permutation(member_ids)[:sample_size])
        blocks = []
        for mid in sample:
            f = facets_by_id.get(mid, {})
            lines = [f"  {k}: {v}" for k, v in f.items() if v]
            blocks.append("- book:\n" + "\n".join(lines))
        prompt = (
            "These books were clustered together by narrative-facet similarity. "
            "Name the *specific* theme they share — the narrative situation, arc, "
            "or trope, at a finer grain than genre (good: 'older protagonists "
            "find a second wind for love'; bad: 'Romance'). Under 10 words, "
            "lowercase.\n\n" + "\n".join(blocks)
        )
        resp = client.messages.create(
            model=config.LABEL_MODEL,
            max_tokens=100,
            output_config={"format": {"type": "json_schema", "schema": {
                "type": "object",
                "properties": {"label": {"type": "string"}},
                "required": ["label"],
                "additionalProperties": False,
            }}},
            messages=[{"role": "user", "content": prompt}],
        )
        text = next(b.text for b in resp.content if b.type == "text")
        names[str(c)] = json.loads(text)["label"].strip()
        print(f"[cluster] {c}: {names[str(c)]} ({len(member_ids)} books)")
    return names


if __name__ == "__main__":
    cluster()

"""Evaluation harness (D14) — is the space thematically specific, or secretly genre?

Two checks against the north-star examples:
  1. Theme-pair set: hand-labeled pairs that should ("share") or should not
     ("differ") be near in a given facet. Reports separation.
  2. Genre-collapse probe: for sampled books, do per-facet nearest neighbors
     cross genre lines (good) or stay within one genre (surface-feature
     collapse)? Reported as neighbor genre-overlap vs. the random baseline.

Seed `data/eval_pairs.jsonl` early:
    {"a": <book_id>, "b": <book_id>, "facet": "arc", "label": "share"|"differ"}
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from . import config
from .facets import FACET_KEYS

EVAL_PAIRS = config.DATA_DIR / "eval_pairs.jsonl"


def evaluate(pairs_path: Path = EVAL_PAIRS) -> dict:
    report = {}
    if pairs_path.exists():
        report["pairs"] = _pair_separation(pairs_path)
    report["genre_collapse"] = _genre_collapse_probe()
    print(f"[evaluate] {json.dumps(report, indent=2)}")
    return report


def _pair_separation(pairs_path: Path) -> dict:
    data = np.load(config.VECTORS_NPZ, allow_pickle=True)
    id_to_row = {str(i): n for n, i in enumerate(data["ids"])}

    shares, differs = [], []
    for line in pairs_path.read_text().splitlines():
        p = json.loads(line)
        va = data[p["facet"]][id_to_row[p["a"]]]
        vb = data[p["facet"]][id_to_row[p["b"]]]
        sim = float(np.dot(va, vb))  # vectors are normalized
        (shares if p["label"] == "share" else differs).append(sim)

    return {
        "n_share": len(shares),
        "n_differ": len(differs),
        "mean_share_sim": float(np.mean(shares)) if shares else None,
        "mean_differ_sim": float(np.mean(differs)) if differs else None,
    }


def _genre_collapse_probe(sample: int = 200, k: int = 10) -> dict:
    """For each facet: fraction of a sampled book's top-k neighbors that share
    ≥1 genre with it, versus the expected overlap between random book pairs.
    A facet space that merely re-discovers genre will sit far above baseline."""
    data = np.load(config.VECTORS_NPZ, allow_pickle=True)
    ids = [str(i) for i in data["ids"]]

    genres = {}
    with config.BOOKS_JSONL.open() as fh:
        for line in fh:
            b = json.loads(line)
            genres[b["id"]] = set(b["genres"])

    rng = np.random.default_rng(42)
    n = len(ids)

    # random-pair baseline
    pairs = rng.integers(0, n, size=(2000, 2))
    baseline = float(np.mean([
        bool(genres.get(ids[a], set()) & genres.get(ids[b], set()))
        for a, b in pairs if a != b
    ]))

    out: dict[str, float] = {"random_pair_baseline": round(baseline, 3)}
    for facet in FACET_KEYS:
        vecs = data[facet]
        mask = data[f"{facet}__mask"]
        rows = np.flatnonzero(mask)
        probe = rng.permutation(rows)[:sample]
        sims = vecs[probe] @ vecs[rows].T  # (sample, n_masked)
        overlaps = []
        for pi, p in enumerate(probe):
            order = np.argsort(-sims[pi])
            neigh = [rows[j] for j in order if rows[j] != p][:k]
            g = genres.get(ids[p], set())
            overlaps.extend(bool(g & genres.get(ids[m], set())) for m in neigh)
        out[facet] = round(float(np.mean(overlaps)), 3)
    return out


if __name__ == "__main__":
    evaluate()

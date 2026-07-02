"""Evaluation harness (D14) — is the space thematically specific, or secretly genre?

Two checks against the north-star examples:
  1. Theme-pair set: hand-labeled pairs that should ("share") or should not
     ("differ") be near in a given facet. Reports separation.
  2. Genre-collapse probe: for sampled books, do per-facet nearest neighbors
     cross genre lines (good) or stay within one genre (surface-feature collapse)?

Seed `data/eval_pairs.jsonl` early:
    {"a": <book_id>, "b": <book_id>, "facet": "arc", "label": "share"|"differ"}
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from . import config

EVAL_PAIRS = config.DATA_DIR / "eval_pairs.jsonl"


def evaluate(pairs_path: Path = EVAL_PAIRS) -> dict:
    data = np.load(config.VECTORS_NPZ, allow_pickle=True)
    id_to_row = {str(i): n for n, i in enumerate(data["ids"])}

    shares, differs = [], []
    for line in pairs_path.read_text().splitlines():
        p = json.loads(line)
        va = data[p["facet"]][id_to_row[p["a"]]]
        vb = data[p["facet"]][id_to_row[p["b"]]]
        sim = float(np.dot(va, vb))  # vectors are normalized
        (shares if p["label"] == "share" else differs).append(sim)

    report = {
        "n_share": len(shares),
        "n_differ": len(differs),
        "mean_share_sim": float(np.mean(shares)) if shares else None,
        "mean_differ_sim": float(np.mean(differs)) if differs else None,
    }
    print(f"[evaluate] {report}")
    return report


if __name__ == "__main__":
    evaluate()

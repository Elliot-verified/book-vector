"""Stage 2.5 — curate the genre-balanced MVP catalog (D4).

The full CMU dataset skews heavily toward speculative fiction, and ~20% of
summaries are too short to carry facet signal. This stage selects the ~2-3k
subset that extraction runs over:

1. Drop books whose summary is under MIN_SUMMARY_WORDS (not enough narrative
   for the five facets).
2. Assign each book to the *rarest* of its genres, so minority genres are not
   drowned out by "Fiction" / "Speculative fiction".
3. Round-robin across genre buckets (seeded shuffle within each) until the
   target count is reached.

Emits `data/catalog.jsonl` with the same record shape as books.jsonl.
"""

from __future__ import annotations

import json
import random
from collections import Counter, defaultdict

from . import config

MIN_SUMMARY_WORDS = 100
SEED = 42


def curate(target: int = config.DEFAULT_CATALOG_LIMIT) -> int:
    """Select a genre-balanced catalog from books.jsonl. Returns count written."""
    books = []
    with config.BOOKS_JSONL.open() as f:
        for line in f:
            b = json.loads(line)
            if len(b["summary"].split()) >= MIN_SUMMARY_WORDS:
                books.append(b)

    genre_counts = Counter(g for b in books for g in b["genres"])

    buckets: dict[str, list[dict]] = defaultdict(list)
    for b in books:
        # rarest genre wins so minority genres keep their books
        key = min(b["genres"], key=lambda g: genre_counts[g]) if b["genres"] else "(none)"
        buckets[key].append(b)

    rng = random.Random(SEED)
    for bucket in buckets.values():
        bucket.sort(key=lambda b: b["id"])  # deterministic base order
        rng.shuffle(bucket)

    selected: list[dict] = []
    bucket_keys = sorted(buckets)
    while len(selected) < target and bucket_keys:
        bucket_keys = [k for k in bucket_keys if buckets[k]]
        for key in bucket_keys:
            if len(selected) >= target:
                break
            if buckets[key]:
                selected.append(buckets[key].pop())

    with config.CATALOG_JSONL.open("w") as out:
        for b in selected:
            out.write(json.dumps(b) + "\n")

    n_genres = len({min(b["genres"], key=lambda g: genre_counts[g]) if b["genres"] else "(none)"
                    for b in selected})
    print(f"[curate] wrote {len(selected)} books across {n_genres} genre buckets "
          f"-> {config.CATALOG_JSONL}")
    return len(selected)


if __name__ == "__main__":
    curate()

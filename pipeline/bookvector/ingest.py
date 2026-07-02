"""Stage 2 — parse the CMU tarball into normalized book records.

The CMU `booksummaries.txt` is TSV with columns:
    wikipedia_id, freebase_id, title, author, pub_date, genres(json), summary

Emits `data/books.jsonl`, one normalized record per line:
    {"id", "title", "author", "genres": [...], "summary"}

The MVP catalog (D4) is a **genre-balanced** subset, not the first N rows:
books are bucketed by their rarest genre and drawn round-robin across genres,
so small genres aren't drowned out by Fiction/Speculative fiction. Selection is
deterministic (fixed seed) so re-runs produce the same catalog.
"""

from __future__ import annotations

import json
import random

from . import config

MIN_SUMMARY_CHARS = 600   # facet extraction needs enough narrative to work with
MAX_SUMMARY_CHARS = 8000  # cap extraction cost on the very longest summaries


def ingest(limit: int | None = None) -> int:
    """Parse the tarball → books.jsonl. Returns the number of records written."""
    books = _parse_all()
    if limit and len(books) > limit:
        books = _genre_balanced_sample(books, limit)

    config.BOOKS_JSONL.parent.mkdir(parents=True, exist_ok=True)
    with config.BOOKS_JSONL.open("w") as out:
        for record in books:
            out.write(json.dumps(record) + "\n")
    print(f"[ingest] wrote {len(books)} records -> {config.BOOKS_JSONL}")
    return len(books)


def _parse_all() -> list[dict]:
    import tarfile

    books = []
    with tarfile.open(config.CMU_TARBALL, "r:gz") as tar:
        member = next(m for m in tar.getmembers() if m.name.endswith("booksummaries.txt"))
        fh = tar.extractfile(member)
        assert fh is not None
        for raw in fh:
            row = raw.decode("utf-8").rstrip("\n").split("\t")
            if len(row) < 7:
                continue
            wiki_id, _fb, title, author, _date, genres_json, summary = row[:7]
            summary = summary.strip()
            if len(summary) < MIN_SUMMARY_CHARS:
                continue
            books.append({
                "id": wiki_id,
                "title": title,
                "author": author,
                "genres": _parse_genres(genres_json),
                "summary": summary[:MAX_SUMMARY_CHARS],
            })
    return books


def _genre_balanced_sample(books: list[dict], limit: int) -> list[dict]:
    """Bucket each book under its rarest genre, then draw round-robin across
    genres. Rare genres survive; giant genres (Fiction, Speculative fiction)
    can't dominate the catalog."""
    genre_counts: dict[str, int] = {}
    for b in books:
        for g in b["genres"] or ["(none)"]:
            genre_counts[g] = genre_counts.get(g, 0) + 1

    buckets: dict[str, list[dict]] = {}
    for b in books:
        genres = b["genres"] or ["(none)"]
        rarest = min(genres, key=lambda g: genre_counts[g])
        buckets.setdefault(rarest, []).append(b)

    rng = random.Random(42)
    for bucket in buckets.values():
        rng.shuffle(bucket)

    selected: list[dict] = []
    order = sorted(buckets)  # deterministic genre order
    while len(selected) < limit and any(buckets.values()):
        for g in order:
            if buckets[g]:
                selected.append(buckets[g].pop())
                if len(selected) >= limit:
                    break
    selected.sort(key=lambda b: int(b["id"]))
    return selected


def _parse_genres(genres_json: str) -> list[str]:
    """CMU genres are a JSON object {freebase_id: name}; keep the names."""
    try:
        return list(json.loads(genres_json).values()) if genres_json else []
    except (ValueError, AttributeError):
        return []


if __name__ == "__main__":
    ingest(limit=config.DEFAULT_CATALOG_LIMIT)

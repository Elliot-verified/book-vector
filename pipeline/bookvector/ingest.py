"""Stage 2 — parse the CMU tarball into normalized book records.

The CMU `booksummaries.txt` is TSV with columns:
    wikipedia_id, freebase_id, title, author, pub_date, genres(json), summary

Emits `data/books.jsonl`, one normalized record per line:
    {"id", "title", "author", "genres": [...], "summary"}
"""

from __future__ import annotations

import json

from . import config


def ingest(limit: int | None = None) -> int:
    """Parse the tarball → books.jsonl. Returns the number of records written."""
    import tarfile

    written = 0
    config.BOOKS_JSONL.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(config.CMU_TARBALL, "r:gz") as tar, \
            config.BOOKS_JSONL.open("w") as out:
        member = next(m for m in tar.getmembers() if m.name.endswith("booksummaries.txt"))
        fh = tar.extractfile(member)
        assert fh is not None
        for raw in fh:
            row = raw.decode("utf-8").rstrip("\n").split("\t")
            if len(row) < 7:
                continue
            wiki_id, _fb, title, author, _date, genres_json, summary = row[:7]
            record = {
                "id": wiki_id,
                "title": title,
                "author": author,
                "genres": _parse_genres(genres_json),
                "summary": summary,
            }
            out.write(json.dumps(record) + "\n")
            written += 1
            if limit and written >= limit:
                break
    print(f"[ingest] wrote {written} records -> {config.BOOKS_JSONL}")
    return written


def _parse_genres(genres_json: str) -> list[str]:
    """CMU genres are a JSON object {freebase_id: name}; keep the names."""
    try:
        return list(json.loads(genres_json).values()) if genres_json else []
    except (ValueError, AttributeError):
        return []


if __name__ == "__main__":
    ingest(limit=config.DEFAULT_CATALOG_LIMIT)

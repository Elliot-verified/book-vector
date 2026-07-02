"""Stage 2 — parse the CMU dataset into normalized book records.

The CMU `booksummaries.txt` is TSV with columns:
    wikipedia_id, freebase_id, title, author, pub_date, genres(json), summary

The source may arrive as the canonical `.tar.gz` or as the mirror's plain
`.txt` (see acquire.py); we detect which from the file's magic bytes.

Emits `data/books.jsonl`, one normalized record per line:
    {"id", "title", "author", "genres": [...], "summary"}
"""

from __future__ import annotations

import json
from pathlib import Path

from . import config


def ingest(limit: int | None = None, source: "str | Path | None" = None) -> int:
    """Parse the dataset → books.jsonl. Returns the number of records written.

    `source` defaults to whatever `acquire` left in the data dir (tarball or
    plain TSV). Rows with fewer than 7 columns are skipped.
    """
    src = _resolve_source(source)
    written = 0
    config.BOOKS_JSONL.parent.mkdir(parents=True, exist_ok=True)
    with config.BOOKS_JSONL.open("w") as out:
        for raw in _iter_tsv_lines(src):
            row = raw.rstrip("\n").split("\t")
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


def _resolve_source(source: "str | Path | None") -> Path:
    if source is not None:
        return Path(source)
    for candidate in (config.CMU_TARBALL, config.CMU_TXT):
        if candidate.exists():
            return candidate
    raise FileNotFoundError(
        "no dataset found — run `acquire` first "
        f"(looked for {config.CMU_TARBALL} and {config.CMU_TXT})"
    )


def _iter_tsv_lines(src: Path):
    """Yield decoded TSV lines from a gzip tarball or a plain .txt, transparently."""
    import tarfile

    with src.open("rb") as probe:
        is_gzip = probe.read(2) == b"\x1f\x8b"

    if is_gzip:  # canonical CMU tarball
        with tarfile.open(src, "r:gz") as tar:
            member = next(m for m in tar.getmembers()
                          if m.name.endswith("booksummaries.txt"))
            fh = tar.extractfile(member)
            assert fh is not None
            for raw in fh:
                yield raw.decode("utf-8")
    else:  # plain TSV (mirror)
        with src.open(encoding="utf-8") as fh:
            yield from fh


def _parse_genres(genres_json: str) -> list[str]:
    """CMU genres are a JSON object {freebase_id: name}; keep the names."""
    try:
        return list(json.loads(genres_json).values()) if genres_json else []
    except (ValueError, AttributeError):
        return []


if __name__ == "__main__":
    ingest(limit=config.DEFAULT_CATALOG_LIMIT)

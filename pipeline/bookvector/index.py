"""Stage 7 — build the sqlite-vec index for serving (D9/D10).

One virtual table per facet so the serverless query function can do per-facet
nearest-neighbor and composed (weighted) queries. At a few thousand books this
is exact brute-force cosine — no approximate index needed.

Emits `data/index.sqlite`, later shipped alongside the serverless fn.
"""

from __future__ import annotations

from . import config
from .facets import FACET_KEYS


def build_index() -> None:
    import sqlite3

    import numpy as np  # lazy import
    import sqlite_vec

    data = np.load(config.VECTORS_NPZ, allow_pickle=True)
    ids = data["ids"]

    if config.INDEX_SQLITE.exists():
        config.INDEX_SQLITE.unlink()
    db = sqlite3.connect(config.INDEX_SQLITE)
    db.enable_load_extension(True)
    sqlite_vec.load(db)

    db.execute("CREATE TABLE books (rowid INTEGER PRIMARY KEY, book_id TEXT UNIQUE)")
    db.executemany("INSERT INTO books (rowid, book_id) VALUES (?, ?)",
                   [(n, str(i)) for n, i in enumerate(ids)])

    for facet in FACET_KEYS:
        dim = data[facet].shape[1]
        db.execute(f"CREATE VIRTUAL TABLE vec_{facet} USING vec0(embedding float[{dim}])")
        db.executemany(
            f"INSERT INTO vec_{facet}(rowid, embedding) VALUES (?, ?)",
            [(n, vec.astype(np.float32).tobytes()) for n, vec in enumerate(data[facet])],
        )
    db.commit()
    db.close()
    print(f"[index] built {len(FACET_KEYS)} facet indexes -> {config.INDEX_SQLITE}")


if __name__ == "__main__":
    build_index()

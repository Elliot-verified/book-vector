"""Stage 8 — export the static galaxy JSON for the web app (D9).

Joins coords (reduce), cluster labels (cluster), and book metadata (ingest +
extract) into one `galaxy.json` the frontend loads directly:

    {
      "facets": [facet keys],
      "clusters": {cluster_id: name},
      "books": [{"id", "title", "author", "genres", "coords": {"xyz", "xy"},
                 "cluster", "facets": {...}}]
    }
"""

from __future__ import annotations

import json
import shutil

from . import config
from .facets import FACET_KEYS


def export() -> None:
    coords = json.loads(config.COORDS_JSON.read_text())
    clusters = json.loads(config.CLUSTERS_JSON.read_text())
    facets_by_id = {}
    with config.FACETS_JSONL.open() as fh:
        for line in fh:
            rec = json.loads(line)
            facets_by_id[rec["id"]] = rec["facets"]

    books = []
    with config.BOOKS_JSONL.open() as fh:
        for line in fh:
            b = json.loads(line)
            if b["id"] not in coords:
                continue  # dropped as non-narrative, or unmapped
            books.append({
                "id": b["id"],
                "title": b["title"],
                "author": b["author"],
                "genres": b["genres"],
                "coords": coords[b["id"]],
                "cluster": clusters["labels"].get(b["id"], -1),
                "facets": facets_by_id.get(b["id"], {}),
            })

    config.WEB_DATA_DIR.mkdir(parents=True, exist_ok=True)
    config.GALAXY_JSON.write_text(json.dumps({
        "facets": list(FACET_KEYS),
        "clusters": clusters["names"],
        "books": books,
    }))
    print(f"[export] wrote {len(books)} books -> {config.GALAXY_JSON}")

    # ship the sqlite-vec index next to the serverless fn (vercel.json includeFiles)
    web_index = config.WEB_DATA_DIR.parent.parent / "data" / "index.sqlite"
    web_index.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(config.INDEX_SQLITE, web_index)
    print(f"[export] copied index -> {web_index}")


if __name__ == "__main__":
    export()

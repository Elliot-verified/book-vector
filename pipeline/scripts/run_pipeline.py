#!/usr/bin/env python
"""Orchestrate the offline pipeline end to end.

    python scripts/run_pipeline.py --limit 2000

Runs: acquire → ingest → extract → embed → cluster → reduce → index → export.
Use --skip to resume partway (e.g. --skip acquire ingest extract).
"""

from __future__ import annotations

import argparse

from bookvector import (
    acquire, cluster, config, embed, export, extract, index, ingest, reduce,
)

STAGES = ["acquire", "ingest", "extract", "embed", "cluster", "reduce", "index", "export"]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=config.DEFAULT_CATALOG_LIMIT,
                    help="max books in the MVP catalog (D4)")
    ap.add_argument("--skip", nargs="*", default=[], choices=STAGES,
                    help="stages to skip (for resuming)")
    args = ap.parse_args()

    def run(name, fn):
        if name in args.skip:
            print(f"[skip] {name}")
            return
        print(f"\n=== {name} ===")
        fn()

    run("acquire", acquire.acquire)
    run("ingest", lambda: ingest.ingest(limit=args.limit))
    run("extract", lambda: extract.extract(limit=args.limit))
    run("embed", embed.embed)
    run("cluster", cluster.cluster)
    run("reduce", reduce.reduce)
    run("index", index.build_index)
    run("export", export.export)
    print("\n[done] artifacts in", config.DATA_DIR)


if __name__ == "__main__":
    main()

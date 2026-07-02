# book-vector pipeline

Offline pipeline that turns the CMU Book Summary Dataset into the artifacts the
web app consumes. Stages mirror the milestones in [`../PLAN.md`](../PLAN.md).

```
acquire → ingest → extract (facets) → embed → cluster → reduce → index
```

| Module | Stage | Output |
|---|---|---|
| `acquire.py` | Fetch/vendor CMU dataset | `data/booksummaries.tar.gz` |
| `ingest.py` | Parse + normalize | `data/books.jsonl` |
| `extract.py` | LLM facet extraction (Haiku + Batch) | `data/facets.jsonl` |
| `embed.py` | Local per-facet embeddings | `data/vectors.npz` |
| `cluster.py` | HDBSCAN + per-cluster labels | `data/clusters.json` |
| `reduce.py` | UMAP → 3D (and 2D) | `data/coords.json` |
| `index.py` | Build `sqlite-vec` index | `data/index.sqlite` |
| `evaluate.py` | Theme-pair eval harness | report |

Run the whole thing:

```bash
pip install -e '.[dev]'
python scripts/run_pipeline.py --limit 2000
```

`acquire` fetches the canonical CMU tarball and **falls back to a GitHub mirror**
of the raw `booksummaries.txt` when the primary host is blocked (this web env's
policy 403s `cs.cmu.edu`); downloads resume on truncation. Override the sources
with `BOOKVECTOR_CMU_URL` / `BOOKVECTOR_CMU_MIRROR_URL`.

The front stages have no heavy dependencies, so you can produce `books.jsonl`
without installing the ML stack — `acquire`/`ingest` (and the rest) lazy-import
their deps:

```bash
python scripts/run_pipeline.py --limit 2000 \
    --skip extract embed cluster reduce index   # acquire + ingest only
```

The **facet taxonomy** lives in `bookvector/facets.py` — it is the single source
of truth for extraction and embedding, and the first thing to validate.

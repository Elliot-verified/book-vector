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

The **facet taxonomy** lives in `bookvector/facets.py` — it is the single source
of truth for extraction and embedding, and the first thing to validate.

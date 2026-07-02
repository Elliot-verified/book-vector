# book-vector pipeline

Offline pipeline that turns the CMU Book Summary Dataset into the artifacts the
web app consumes. Stages mirror the milestones in [`../PLAN.md`](../PLAN.md).

```
acquire → ingest → extract (facets) → embed → cluster → reduce → index → export
```

| Module | Stage | Output |
|---|---|---|
| `acquire.py` | Fetch/vendor CMU dataset | `data/booksummaries.tar.gz` |
| `ingest.py` | Parse + genre-balanced catalog (D4) | `data/books.jsonl` |
| `extract.py` | LLM facet extraction (Haiku + Batch API, structured outputs) | `data/facets.jsonl` |
| `embed.py` | Local per-facet embeddings + empty-facet masks | `data/vectors.npz` |
| `cluster.py` | UMAP→HDBSCAN + per-cluster LLM theme labels | `data/clusters.json` |
| `reduce.py` | UMAP → 3D (and 2D) galaxy coords | `data/coords.json` |
| `index.py` | Build `sqlite-vec` index (mask-aware) | `data/index.sqlite` |
| `export.py` | Join everything for the web app | `../web/public/data/galaxy.json`, `../web/data/index.sqlite` |
| `evaluate.py` | Theme-pair eval + genre-collapse probe (D14) | report |

Run the whole thing:

```bash
pip install -e '.[dev]'
export ANTHROPIC_API_KEY=...           # extraction + cluster labels
python scripts/run_pipeline.py --limit 2000
```

Notes:

- **Extraction is batched and resumable** — the in-flight batch id is stored in
  `data/batch_id.txt`; re-running `extract` resumes polling instead of paying
  for a new batch. Cost for the 2k catalog is ~a dollar (Haiku + Batch 50%).
- **Embeddings** default to `BAAI/bge-base-en-v1.5` via `fastembed` (ONNX, CPU,
  $0), because this web environment's network policy blocks huggingface.co and
  fastembed mirrors base/small on `storage.googleapis.com`. On a machine with
  HF access, set `BOOKVECTOR_EMBED_BACKEND=sentence-transformers` and
  `BOOKVECTOR_EMBED_MODEL=BAAI/bge-large-en-v1.5` for the PLAN.md D5 default.
  To pre-seed the fastembed cache without HF access:

  ```bash
  mkdir -p ~/.cache/fastembed && export FASTEMBED_CACHE_PATH=~/.cache/fastembed
  curl -sSL https://storage.googleapis.com/qdrant-fastembed/fast-bge-base-en-v1.5.tar.gz \
    | tar xz -C $FASTEMBED_CACHE_PATH
  export HF_HUB_OFFLINE=1
  ```

- **Empty facets are masked**: a book with no `twist` never appears in the
  twist facet space (vectors.npz `<facet>__mask`, skipped rows in
  `index.sqlite`, excluded from that facet's clustering).

The **facet taxonomy** lives in `bookvector/facets.py` — it is the single source
of truth for extraction and embedding, and the first thing to validate.

# book-vector

Explore a high-dimensional vector database of books as a **3D visualization**,
where proximity means *"these books share a specific narrative theme"* — clusters
that are **more specific than genre** (narrative situations, arcs, tropes).

See [`PLAN.md`](./PLAN.md) for the full design and the locked architecture
decisions (D1–D14).

## Core idea

Each book's plot summary is decomposed by an LLM into **per-facet fields**
(protagonist, relationship, arc, setting-as-device, twist), and each field is
embedded separately. This gives **disentangled similarity** — "find books with a
similar relationship arc, ignoring setting" — not just whole-book similarity.

## Repository layout

```
book-vector/
├── PLAN.md              # design doc + architecture decisions
├── NOTICE               # attribution for CC BY-SA source data
├── pipeline/            # Python: acquire → extract → embed → cluster → index
│   └── bookvector/      # the pipeline package
└── web/                 # React + react-three-fiber galaxy & constellation
    └── api/             # Vercel serverless fn: per-facet queries (sqlite-vec)
```

## Quick start

Pipeline (offline, produces artifacts):

```bash
cd pipeline
pip install -e .
python scripts/run_pipeline.py --limit 2000   # ~2–3k book MVP catalog
```

Web (galaxy + constellation):

```bash
cd web
npm install
npm run dev
```

## Status

Scaffolding. Modules are stubs wired to the pipeline described in `PLAN.md`;
the facet **extraction schema** (`pipeline/bookvector/facets.py`) is the first
thing to design and validate — it's the heart of the system.

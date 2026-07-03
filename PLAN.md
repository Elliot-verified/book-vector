# book-vector — Planning Doc

A book recommendation tool that lets a user explore a high-dimensional vector
database of books as a **3D visualization**, where proximity means *"these
books share a specific narrative theme."* The aim is to cluster **more
specifically than genre** — at the level of narrative situations, arcs, and
tropes, not topics.

## North star

Most book tools cluster at the genre/topic level ("Romance," "Coming of age").
`book-vector` aims for **thematic specificity** — clusters like:

- *"Protagonist has a coming-of-age realization while traveling abroad"*
  (not just "Coming of age")
- *"A dark villain turns out to be the good guy"* (not just "Uplifting")
- *"Older protagonists who find a second wind for love"* (not just "Romance")

Rich semantic information is the *asset*, not the enemy: we lean into it and
**decompose each book into per-facet vectors** so similarity and specificity can
operate one narrative axis at a time.

## The core capability we're building for

A facet buys one of two things; we are explicitly building the harder one:

1. **Filtering / composition** — "books that are *both* about older protagonists
   *and* a second-wind romance." (Intersection.)
2. **Disentangled similarity** — "books with a *similar relationship arc*,
   ignoring setting." (Compare along one axis, ignore the rest.)

We are building for **(2)** — the "these two books share a soul in their arc
even though everything on the surface differs" experience. Only true per-facet
vectors deliver it. (Filtering falls out for free once we have them.)

## Architecture decisions (locked)

| # | Decision | Choice | Notes |
|---|---|---|---|
| D1 | **Commercial posture** | Commercial-viable | Facets come from our own extraction of CC-BY-SA summaries — no non-commercial dependency in v1 |
| D2 | **Trope source role** | Optional enrichment / validation only | TVTropes (CC BY-NC-SA) is off the critical path; used to cross-check facets, never as the backbone |
| D4 | **Catalog scope** | ~2–3k curated books first | Genre-balanced subset; expand toward full 16.5k after the space is validated |
| D5 | **Embedding model** | Local open model | `bge-large` / `nomic-embed` via sentence-transformers; $0, no API dependency |
| **D6** | **Facet realization** | **Option B — true per-facet vectors** | LLM *extracts* facet fields from each summary; embed each field separately |
| D7 | **Facet taxonomy** | 4 facets (twist dropped in v1 — see below) | The extraction schema is the heart of the pipeline |
| D8 | **Clustering** | HDBSCAN offline + per-cluster LLM labels | Labels are per-cluster, not per-book — cheap |
| D9 | **Serving model** | Hybrid | Static precomputed galaxy JSON + a serverless `sqlite-vec` function for live per-facet queries |
| D10 | **Nearest-neighbor** | Exact brute-force cosine | A few thousand books — no approximate index needed |
| D11 | **Frontend** | React + react-three-fiber + TS | 2D/3D toggle |
| D12 | **Deploy** | Vercel | Static galaxy + serverless query fn |
| D13 | **Repo layout** | Monorepo | `pipeline/` (Python) + `web/` (React) |
| D14 | **Evaluation** | Seed a hand-labeled theme-pair set early | Tune the granularity dial; catch surface-feature collapse |

## Cost model: minimal, cheap extraction (not zero-generation)

We chose **Option B**, so v1 is no longer strictly zero-generation — but the
spend is tiny and bounded:

- **Not** per-book prose synthesis. We run **extraction only**: an LLM reads a
  summary and emits a small structured JSON of facet fields.
- **Haiku + Batch API** over the ~2–3k MVP summaries is **cents to low single
  dollars**; even the full 16.5k stays cheap.
- Embeddings remain **$0** — a local sentence-transformers model embeds each
  extracted facet field.
- Cluster labeling is a **handful of calls per cluster**, not per book.

The real cost of Option B is **validation effort**, not tokens — see risks.

## The embedding: true per-facet vectors (Option B)

A single whole-summary embedding blends everything (setting bleeds into arc).
To get disentangled similarity we decompose per book:

1. **Extract facet fields** from each plot summary via a cheap LLM pass into a
   strict schema (D7):
   - `protagonist` — archetype / defining attributes (e.g. "aging widower")
   - `relationship` — central dynamic (e.g. "second-wind late-life romance")
   - `arc` — transformation / character change (e.g. "coming-of-age realization")
   - `setting_as_device` — how setting functions narratively (e.g. "displacement
     abroad forces self-confrontation")
   - ~~`twist` — structural/moral turn~~ *(removed in v1 — see execution status:
     ~20% of books had no twist, and the empty-string embeddings split the
     galaxy into a spurious "has-a-twist vs not" pair of blobs)*
2. **Embed each field separately** (local model) → 4 vectors per book.
3. **Query per facet:** high cosine in the relationship space + low in the
   setting space = "similar romance, different world." Compose facets with
   weights for the intersection queries too.

Because facets come from **our own extraction of the CC-BY-SA summaries**, this
approach is full-coverage (every book with a summary), uses **our** taxonomy
rather than TVTropes', and carries **no NC license exposure** (D1/D2).

### Extraction schema is the product
The facet taxonomy + extraction prompt *is* the heart of the pipeline. Extraction
quality flows straight into the vectors, so prompt design + a validation pass are
the main engineering work (replacing "the join" as the biggest task). Normalize
aggressively (controlled vocabulary where possible) to keep facet spaces clean.

## TVTropes: validation, not backbone

With Option B, tropes are demoted to an **optional cross-check**: does our
extracted `twist` facet agree with the `Heel–Face Turn` trope where both exist?
Useful as a quality signal on extraction, and as coverage glue for
under-described books — but nothing depends on it, so the CC BY-NC-SA license
never touches the critical path. Wiring tropes in is a post-v1 nicety.

## The central tension: the granularity dial

Specificity trades against cluster size:

- Too coarse → "Romance" (boring; already escaped)
- Too fine → "older + second-wind + abroad + villain-redemption" matches *zero
  books*. Hyper-specific themes are singletons — no cluster, no recommendation.

The sweet spot varies by theme, which is *why* the design is per-facet and
composable rather than one global cluster resolution. Managing this dial is the
core craft of v1.

## Clustering: emergent + curated lenses

- **Curated / faceted lenses (primary):** name a theme or compose facets with
  weights → retrieve/highlight matching books. Reliably produces the target
  examples; this is where disentangled similarity shines.
- **Emergent (discovery layer):** cluster (HDBSCAN) → per-cluster LLM labels
  ("these 14 share: coming-of-age abroad"). "Themes you didn't ask for."

## The 3D visualization

Two modes, toggleable:

1. **Galaxy** — project book vectors to 3D once (offline) with **UMAP**, cache
   coords. Star map; color by dominant facet/theme. (Projection is over a chosen
   facet or a concatenation — a UI decision to explore.)
2. **Constellation** — pick a book, show it + K nearest neighbors as a
   force-directed graph, edges weighted by per-facet similarity, with *why*
   (which facets match) surfaced.

Diving from a galaxy point into its constellation is the core interaction loop.

### Rendering stack
- `three.js` + `react-three-fiber` — instanced meshes handle 10k+ points.
- Build the projection so it can **also render in 2D** — the value of the 3rd
  dimension for browsing is unproven; compare, don't assume.

## Data pipeline (v1)

```
CMU Book Summary Dataset (16.5k books, plot summaries + author/title/genre)
        │
        ▼
   LLM facet extraction (Haiku + Batch)  ──►  per-book facet JSON  (cheap)
        │
        ▼
   local embedding model (sentence-transformers)  ──►  4 facet vectors/book  ($0)
        │
        ├─►  HDBSCAN clustering ──► per-cluster LLM labels
        ├─►  UMAP (offline) ──► coords3d.json
        └─►  sqlite-vec index (per-facet nearest-neighbor + composed queries)
        │
        ▼
   web app: static galaxy (r3f, 2D/3D) + serverless query fn (faceted lenses)
        ▲
        └─ (optional) TVTropes tags joined in as a validation cross-check
```

- **MVP catalog:** ~2–3k genre-balanced books, not all 16.5k.
- **Vector store:** `sqlite-vec` (or `numpy` + brute-force cosine) — no managed
  vector DB at this scale.

## Dataset status & access

- **CMU Book Summary Dataset** — ✅ confirmed. 16,559 books, Wikipedia plot
  summaries + metadata (author/title/genre/date), **CC BY-SA**, 17 MB
  `booksummaries.tar.gz`. Official page + Kaggle mirror.
  - ⚠️ **Network:** this web environment's policy blocks `www.cs.cmu.edu` (proxy
    403 on CONNECT). Ingest by widening the env network policy *or* vendoring the
    tarball via a reachable host (GitHub release; `github.com` /
    `raw.githubusercontent.com` are reachable here). CC BY-SA permits
    redistribution with attribution + share-alike (add a NOTICE file).
- **TVTropes / DBTropes** — optional (D2). Sources: DBTropes RDF (structured but
  possibly stale), HuggingFace dumps (fresh, raw). **License CC BY-NC-SA 3.0
  (non-commercial)** — kept off the critical path, so it does not constrain a
  commercial v1. Do **not** vendor tropes into the repo; widen policy or scrape
  at build time if used.

## MVP milestones

1. **Acquire** — CMU dataset into the env (widen policy or vendor via GitHub
   release).
2. **Design the extraction schema** — facet taxonomy + prompt; iterate on a
   handful of books until fields are clean and consistent. *This is the product.*
3. **Extract** — Haiku + Batch over the ~2–3k subset → facet JSON. Spot-check.
4. **Embed** — local model over each facet field → per-facet vectors. $0.
5. **Cluster + reduce** — HDBSCAN; per-cluster labels; UMAP → `coords3d.json`.
   Hand-audit against the north-star examples: specific themes, or secretly
   genre?
6. **Render** — r3f galaxy (2D + 3D toggle), hover tooltip, color by theme.
7. **Constellation + lenses** — per-facet nearest neighbors with "why";
   composable faceted lenses via the serverless `sqlite-vec` fn.
8. **Iterate** — tune the granularity dial; refine facet definitions from real
   clusters. (Optional: join TVTropes as validation.)

## Risks & open assumptions

- **Extraction quality (new #1 risk):** LLM facet extraction can hallucinate or
  normalize inconsistently, and that garbage flows straight into the vectors.
  Mitigation: tight schema, controlled vocabulary, a validation pass, and
  spot-checks; optional TVTropes cross-check. *This is the main engineering work.*
- **Granularity dial:** too-specific → singletons, too-coarse → genre. Mitigated
  by per-facet composition; still needs hands-on tuning against real clusters.
- **Do target themes emerge?** Examples read like curated queries. Mitigation:
  faceted lenses primary, emergent clustering as discovery.
- **Surface-feature collapse:** facet vectors may still cluster by setting/genre.
  Mitigation: per-facet decomposition is the direct defense; audit against
  north-star examples early (milestone 5).
- **Coverage ceiling:** CMU skews toward *notable* titles; literary long tail is
  thin. Acceptable for MVP, but a real limit.
- **Is the 3rd dimension worth it?** 3D point clouds demo well but browse poorly.
  Mitigation: 2D/3D toggle, compare in practice.
- **Evaluation:** specific themes are auditable — read a cluster. Seed a small
  hand-labeled "share a theme / don't" set early to tune the dial and detect
  surface-feature collapse.

## Execution status (2026-07-02)

Milestones 1–7 are **done**; the pipeline has run end-to-end in this repo and
the app has been verified against the artifacts it produced.

- **Catalog:** 2,000 genre-balanced books ingested (rarest-genre round-robin);
  1,944 survived extraction (56 non-narrative works dropped for having <3
  facets).
- **Facet set (deviation from D7):** dropped from 5 to **4** — the `twist`
  facet was absent for 399/1,944 books (~20%), and in the concatenated galaxy
  layout their shared empty-string embeddings formed a spurious second blob
  ("has-a-twist vs not," 99.5% pure), disconnected from the main mass. The
  other four facets are missing for ≤3 books each. Removed twist from the
  taxonomy, embeddings, index, and UI rather than paper over it; the layout is
  now one organic mass.
- **Extraction:** Haiku + Batch API with structured outputs (guaranteed-valid
  JSON), resumable via `data/batch_id.txt`; 1,997/2,000 succeeded in-batch, 3
  retried directly. Cost ~$1.
- **Embeddings (deviation from D5):** `bge-base-en-v1.5` via fastembed's ONNX
  mirror on `storage.googleapis.com` — this environment's network policy blocks
  `huggingface.co`, so `bge-large` was unreachable. The sentence-transformers /
  bge-large path remains available via `BOOKVECTOR_EMBED_BACKEND`.
- **Clustering:** the granularity dial landed on UMAP(20d) → HDBSCAN with
  `cluster_selection_method="leaf"`, `min_cluster_size=8`: 84 clusters,
  ~36% noise. Default `eom` selection collapses the space into 2 mega-clusters.
  Labels are at north-star specificity (e.g. *"women discovering they were
  pawns in others' orchestrated schemes"*, *"orphaned outsider discovers true
  identity while learning to choose love over destiny"*).
- **Milestone-5 audit:** per-facet nearest neighbors share a genre only 32–41%
  of the time vs a 28% random baseline (arc: 31.8%) — the spaces did **not**
  collapse to genre. Disentangled similarity spot-checks pass: *What Dreams May
  Come* under an arc-only lens retrieves *The Death of Ivan Ilyich* and a
  Thoreau-style memoir of accepting mortality.
- **Eval seed (D14):** 13 hand-labeled arc pairs in
  `pipeline/data/eval_pairs.jsonl`; share pairs mean cosine 0.71 vs differ
  0.65. Margin is thin in absolute terms (bge similarity range is compressed) —
  ranking quality is the metric that matters and is good; tightening this is
  milestone-8 work.
- **Serving:** galaxy.json (static) + sqlite-vec weighted per-facet queries via
  a shared `queryCore` running identically under vite dev middleware and the
  Vercel function. Deployment to Vercel (D12) has not been run yet.

Remaining (milestone 8 / post-v1): granularity-dial iteration against the eval
set, richer constellation rendering (currently a ranked list with per-facet
"why" chips), full 16.5k extraction, TVTropes cross-check, Vercel deploy.

## Future (post-v1)

- **Full-catalog extraction:** extend Haiku extraction to all 16.5k (still cheap).
- **TVTropes enrichment:** join tropes as a validation signal / coverage glue.
- **Personalization:** rate a few books, weight facets to taste, re-center the
  galaxy.
- **Affective facet:** fold the original "how it makes you feel" idea back in as
  one more facet alongside the structural ones.

# book-vector — Planning Doc

A book recommendation tool that lets a user explore a high-dimensional vector
database of books as a **3D visualization**, where proximity means *"these
books share a specific narrative theme."* The aim is to cluster **more
specifically than genre** — at the level of narrative situations and tropes,
not topics.

## North star

Most book tools cluster at the genre/topic level ("Romance," "Coming of age").
`book-vector` aims for **thematic specificity** — clusters like:

- *"Protagonist has a coming-of-age realization while traveling abroad"*
  (not just "Coming of age")
- *"A dark villain turns out to be the good guy"* (not just "Uplifting")
- *"Older protagonists who find a second wind for love"* (not just "Romance")

Rich semantic information is the *asset*, not the enemy: we lean into it to make
clusters more specific, and use human-curated structural metadata to capture
narrative arcs (twists, transformations) that surface text doesn't expose.

## Locked-in decisions

| Decision | Choice | Why |
|---|---|---|
| **Clustering goal** | Thematic micro-clusters (more specific than genre) | The whole point — specific themes are useful *and* auditable |
| **Embedding (v1)** | **Zero-generation:** local embeddings of existing plot summaries + crowd trope tags as facets | No per-book Claude cost; prove the space before spending |
| **Viz** | Galaxy overview + dive-in constellation, toggleable | Discovery by wandering *and* "find books like X" |
| **Primary dataset** | **CMU Book Summary Dataset** (confirmed: free, CC BY-SA, ~16.5k books) | Plot-complete summaries — captures arcs/twists blurbs hide |
| **Facet source** | TVTropes / DBTropes (pending access confirmation) | Crowd has already distilled structural tropes (e.g. `Heel–Face Turn`) |

## Why zero-generation

The expensive LLM operation is **generation** (synthesizing new text per book),
not **embedding**. So v1 spends $0 on generation by standing on two free assets:

1. **Plot summaries already exist** — the CMU dataset has 16,559 Wikipedia plot
   summaries. We don't generate them; we embed them with a **local
   open-source embedding model** (`bge-large` / `e5` / `nomic-embed` via
   sentence-transformers) — free, runs on a modest GPU/CPU.
2. **Structural distillation already done by the crowd** — TVTropes tropes are
   named narrative features (`Heel–Face Turn` = villain turns good,
   `December–December Romance` = older second-wind love, `Coming-of-Age Story`).
   These map almost 1:1 onto the target themes and require no generation.

Any Claude pass is deferred past v1, and even then would be Haiku + Batch API on
a small enrichment subset — not the whole catalog.

## The embedding: faceted semantic vectors

A single blurb-level embedding clusters by **surface features** (setting, genre
furniture). The target themes are **structural** (arc, twist, protagonist
attribute). Two design moves get us there:

1. **Embed plot summaries, not blurbs.** Plot summaries are spoiler-complete, so
   arc/twist themes ("villain turns good") are actually present in the text.
   This is why the CMU dataset matters specifically.
2. **Faceted multi-vector representation.** Decompose each book into separate
   facet vectors so specificity is *composable*:
   - protagonist archetype
   - central relationship / dynamic
   - transformation / character arc
   - setting-as-narrative-device
   - twist / structural type
   - (later) affective tone

   "Older protagonists" (protagonist facet) ∩ "second-wind love" (relationship
   facet) produces the micro-cluster on demand — without needing one book that
   matches every facet at once.

In v1, facets are sourced cheaply: plot-summary embeddings give the semantic
base; TVTropes tropes (grouped into facet categories) give the structural
overlay. No generation required.

## The central tension: the granularity dial

Specificity trades against cluster size:

- Too coarse → "Romance" (boring; already escaped)
- Too fine → "older + second-wind + abroad + villain-redemption" matches *zero
  books*. Hyper-specific themes are singletons — no cluster, no recommendation.

The sweet spot varies by theme, which is *why* the design is faceted and
composable rather than one global cluster resolution. Managing this dial is the
core craft of v1 and replaces "genre collapse" as the risk to watch.

## Clustering: emergent + curated lenses

Two complementary modes (the target examples favor the second):

- **Emergent:** embed → cluster (HDBSCAN) → **LLM labels each discovered
  cluster** post-hoc ("these 14 books share: coming-of-age abroad"). Discovery
  layer. Caveat: dominant variance is often still setting/genre, so crisp themes
  may not self-organize. (Labeling is a tiny, cheap LLM use — a handful of calls
  per cluster, not per book; compatible with the zero-generation budget.)
- **Curated / queryable lenses:** name a specific theme (or compose facets) and
  retrieve/highlight matching books in the galaxy — faceted semantic search.
  This reliably produces the exact target examples.

Plan: curated/faceted as the primary navigation, emergent clustering as a
"themes you didn't ask for" discovery layer on top.

## The 3D visualization

Two modes, toggleable:

1. **Galaxy** — project all book vectors to 3D once (offline) with **UMAP**,
   cache coords. Render as a star map; color by dominant facet/theme.
2. **Constellation** — pick a book, show it + K nearest neighbors as a
   force-directed graph, edges weighted by similarity, with *why* (shared
   facets/tropes) surfaced.

Diving from a galaxy point into its constellation is the core interaction loop.

### Rendering stack
- `three.js` + `react-three-fiber` — instanced meshes handle 10k+ points.
- Build the projection so it can **also render in 2D** — the value of the 3rd
  dimension for browsing is unproven (occlusion/disorientation); we want to
  compare, not assume.

## Data pipeline (zero-generation v1)

```
CMU Book Summary Dataset (16.5k books, plot summaries + author/title/genre)
        │
        ├─ join ─►  TVTropes / DBTropes trope tags   (entity resolution by title+author)
        │           Goodreads/LibraryThing tags (coverage glue)
        ▼
   local embedding model (sentence-transformers)  ──►  facet vectors  (FREE)
        │
        ├─►  HDBSCAN clustering ──► (cheap) LLM cluster labels
        │
        ├─►  UMAP (offline) ──► coords3d.json
        │
        └─►  FAISS / sqlite-vec index (nearest-neighbor + faceted query)
        ▼
   web app (r3f galaxy + constellation, faceted lenses)
```

- **MVP catalog:** start with a few thousand well-covered books from the join,
  not all 16.5k — enough to form real clusters, cheap to iterate on.
- **Vector store:** `numpy` + FAISS or `sqlite-vec`. No managed vector DB at
  this scale.

## Dataset status & access

- **CMU Book Summary Dataset** — ✅ confirmed available. 16,559 books, Wikipedia
  plot summaries + Freebase metadata (author/title/genre/date), **CC BY-SA**,
  17 MB `booksummaries.tar.gz`. Official page + Kaggle mirror.
  - ⚠️ **Network caveat:** this Claude-Code-on-the-web environment's network
    policy currently blocks `www.cs.cmu.edu` (proxy returns 403 to CONNECT). To
    ingest inside a web session we must either widen the env network policy to
    allow the host, or vendor the tarball in via an allowed mirror. Not a
    blocker for the project; it's an environment setting.
  - **License note:** CC BY-SA is share-alike — attribute and license-alike any
    redistributed derived data (e.g. published vectors).
- **TVTropes / DBTropes** — ⏳ access + license to confirm as a v1 ingestion
  task.

## MVP milestones

1. **Acquire** — get CMU dataset into the env (open network policy or vendor in);
   confirm TVTropes/DBTropes access + license.
2. **Join** — entity-resolve CMU ↔ tropes ↔ tags by title+author (ISBN /
   OpenLibrary IDs where present). *This is the unglamorous time sink.*
3. **Embed** — local embedding model over plot summaries → facet vectors. $0.
4. **Cluster + reduce** — HDBSCAN; cheap LLM labels; UMAP → `coords3d.json`.
   Hand-audit: are clusters thematically specific, or secretly genre? (Test the
   north-star examples directly.)
5. **Render** — r3f galaxy (2D + 3D toggle), hover tooltip, color by theme.
6. **Constellation + lenses** — nearest neighbors with shared-facet "why";
   faceted/curated theme lenses.
7. **Iterate** — tune the granularity dial; refine facet definitions from real
   clusters.

## Risks & open assumptions

- **Granularity dial (central):** too-specific themes collapse to singletons,
  too-coarse to genre. Mitigated by composable facets; still needs hands-on
  tuning. *We won't know the sweet spot until we see real clusters.*
- **Do target themes actually emerge?** The examples read like curated queries,
  not guaranteed unsupervised clusters. Mitigation: curated/faceted lenses as
  primary, emergent clustering as discovery layer.
- **Surface-feature collapse:** plot-summary embeddings may still cluster by
  setting/genre rather than arc. Mitigation: faceted decomposition + trope
  overlay; *audit against the north-star examples early* (milestone 4).
- **Coverage ceiling:** CMU + TVTropes skew toward *notable* / genre-popular
  titles; literary long tail is thin and under-tagged. Acceptable for an MVP
  (notable books = books people seek), but a real limit.
- **The join is the work:** no shared IDs across datasets; fuzzy
  entity-resolution is the largest v1 task. Free, but slow.
- **Is the 3rd dimension worth it?** 3D point clouds demo well but browse
  poorly. Mitigation: 2D/3D toggle, compare in practice.
- **Evaluation (now tractable):** specific themes are *auditable* — open a
  cluster and read it. Seed a small hand-labeled "these share a theme / don't"
  set early to tune the dial and detect surface-feature collapse.

## Future (post-v1)

- **Optional LLM enrichment:** Haiku + Batch API to distill narrative profiles
  for books the crowd missed — small subset, still cheap.
- **Personalization:** rate a few books, weight facets to taste, re-center the
  galaxy.
- **Affective facet:** fold the original "how it makes you feel" idea back in as
  one facet among the structural ones.

# book-vector — Planning Doc

A book recommendation tool that lets a user explore a high-dimensional vector
database of books as a **3D visualization**, where proximity means *"these
books make you feel the same way"* — affective similarity, not lexical or
semantic content similarity.

## North star

Most book tools embed on **content** (plot, genre, topic). `book-vector`
embeds on **felt experience**: a 1920s novel and a contemporary sci-fi book can
sit next to each other because both left readers hollow and aching. The
emotional embedding space is the soul of the project; everything else is
plumbing in service of it.

## Locked-in decisions

| Decision | Choice | Why |
|---|---|---|
| **Viz purpose** | Both — galaxy overview + dive-in constellation, toggleable | Discovery by wandering *and* "find books like X" |
| **Embedding (v1)** | LLM affect axes | Interpretable, cheap, makes clusters nameable; best MVP |
| **Data source** | Existing dataset (Goodreads / UCSD Book Graph style) | Fastest to a working prototype, fixed catalog |
| **First deliverable** | This plan, then scaffold | — |

## The embedding: LLM affect axes

Define an explicit emotional basis. For each book, prompt Claude to score it
`0.0–1.0` on each axis using the book's description + a sample of reader
reviews. The resulting vector *is* the embedding. Because the axes are named,
regions of the 3D plot are nameable ("the bleak-but-beautiful corner").

Proposed starting basis (~12 axes — tune after eyeballing real clusters):

| Axis | Low (0.0) ↔ High (1.0) |
|---|---|
| `valence` | bleak ↔ joyful |
| `tension` | calm, slow ↔ tense, gripping |
| `warmth` | cold, detached ↔ intimate, tender |
| `hope` | hopeless ↔ hopeful |
| `melancholy` | light ↔ aching, wistful |
| `whimsy` | grave, serious ↔ playful, whimsical |
| `scale` | small, domestic ↔ epic, cosmic |
| `unease` | comforting ↔ disturbing, unsettling |
| `wonder` | mundane ↔ awe, sense-of-wonder |
| `intensity` | gentle ↔ overwhelming |
| `humor` | earnest ↔ funny |
| `comfort` | challenging ↔ cozy comfort-read |

### Scoring contract
- Input: `{title, author, description, sample_reviews[]}`
- Output: strict JSON `{axis: float}` for every axis, plus a one-line
  `rationale` for debuggability.
- Run as a batch job offline; cache results keyed by book id. Re-score only
  when the axis set changes.

### Later: richer signal (v2+)
- **Option B — review embeddings:** filter reviews to *affective* sentences
  (LLM pass), embed each, mean-pool into a per-book "reader-reaction vector."
  Captures organic emotional language the fixed axes miss.
- **Option C — hybrid:** concatenate affect axes + review embedding. Explainable
  skeleton + rich texture. This is the long-term target.

## The 3D visualization

Two modes, toggleable:

1. **Galaxy** — project *all* book vectors to 3D once (offline) with **UMAP**
   (better global-structure preservation than t-SNE), cache the coords. Render
   as a star map; color by dominant emotion, size by intensity.
2. **Constellation** — pick a book, show it + its K nearest neighbors as a
   force-directed graph, edges weighted by cosine similarity. The "I loved X,
   what's near it" view. Show *why*: which axes match.

Diving from a galaxy point into its constellation is the core interaction loop.

### Rendering stack
- `three.js` + `react-three-fiber` — instanced meshes handle 10k+ points
  smoothly.
- Hover → title/author tooltip. Click → constellation + "why these match."

## Data pipeline

```
dataset (books + reviews)
   └─► sample N reviews/book
        └─► LLM affect scoring  ──►  vectors.json  (book_id → 12-dim vector)
                                      │
              ┌───────────────────────┘
              ▼
        UMAP fit (offline)  ──►  coords3d.json  (book_id → [x,y,z])
              │
              ▼
        FAISS / sqlite-vec index  (for nearest-neighbor at query time)
              │
              ▼
        web app (r3f galaxy + constellation)
```

- **Catalog size for MVP:** ~500–2000 books. Big enough to form real clusters,
  small enough to score cheaply and load client-side.
- **Vector store:** start with `numpy` + **FAISS** or **`sqlite-vec`** — no
  managed vector DB needed at this scale. Revisit (Pinecone/pgvector) only if
  the catalog grows large or goes multi-tenant.

## Proposed repo structure

```
book-vector/
├── PLAN.md                  # this file
├── data/                    # raw dataset + generated artifacts (gitignored if large)
│   ├── books.jsonl
│   ├── vectors.json
│   └── coords3d.json
├── pipeline/                # offline batch jobs (Python)
│   ├── ingest.py            # load + sample reviews
│   ├── score_affect.py      # LLM affect scoring → vectors.json
│   ├── reduce.py            # UMAP → coords3d.json
│   └── build_index.py       # FAISS / sqlite-vec
└── web/                     # react-three-fiber front end
    ├── galaxy view
    └── constellation view
```

## MVP milestones

1. **Data** — pull a free Goodreads/UCSD Book Graph dataset; pick ~1k books
   with enough reviews; `ingest.py` samples reviews per book.
2. **Embed** — `score_affect.py` LLM-scores each book on the 12 axes →
   `vectors.json`.
3. **Reduce** — `reduce.py` UMAP → `coords3d.json`; sanity-check clusters by
   hand (do the moods make sense?).
4. **Render** — r3f galaxy: points colored by dominant emotion, hover tooltip.
5. **Constellation** — click a book → nearest neighbors + matching-axis
   explanation.
6. **Iterate** — refine the axis set from real clusters; then layer in review
   embeddings (Option B/C).

## Open questions / future

- Final axis set — validate against real clusters and prune correlated axes.
- Personalization: let a user rate a few books, then weight axes to their taste
  (re-center the galaxy on *their* emotional palette).
- Cold-start for books with few reviews (lean on description-only scoring).
- Evaluation: how do we know recommendations are *good*? Small user study or
  "you liked X, here's Y — was it the right feeling?" feedback loop.

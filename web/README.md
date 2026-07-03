# book-vector web

React + react-three-fiber front end: a **galaxy** overview (2D/3D toggle) with a
scrollable "hyperniche genres" sidebar (click a theme to fly the camera to that
cluster), a dive-in **constellation** of a book's per-facet nearest neighbors
driven by composable **facet lenses**, and a **book-in-the-middle** finder that
locates the book between any two.

```bash
npm install
npm run dev      # http://localhost:5173
```

## Data

Produced by the pipeline's `export` stage (committed so Vercel git builds have
them; regenerate with `pipeline/scripts/run_pipeline.py`):

- `public/data/galaxy.json` — coords + book metadata + cluster theme labels;
  the galaxy loads this directly in the browser.
- `data/vectors.bin` + `data/vectors.meta.json` — int8-quantized per-facet
  vectors the query function brute-forces over (exact cosine). **Pure data, no
  native modules** — queries run in plain JS, so there is no sqlite-vec /
  better-sqlite3 to fail to bundle on Vercel. In dev a vite middleware serves
  `/api/query` from the same `server/queryCore.ts` the Vercel function uses; on
  Vercel the file ships with the function via `vercel.json` `includeFiles`.

## Layout

```
src/
  App.tsx                 # galaxy ⇄ constellation mode switch, cluster/focus state
  components/
    Galaxy.tsx            # instanced point cloud (2D/3D), cluster colors, fly-to
    Sidebar.tsx           # hyperniche-genre list + book-in-the-middle finder
    Constellation.tsx     # nearest neighbors + per-facet "why" chips + facet lens
    FacetLens.tsx         # weight facets to re-rank neighbors
    BookPicker.tsx        # title autocomplete over the catalog
    BookTooltip.tsx       # hover card (title, author, cluster theme)
  lib/api.ts              # client for the query function (neighbors + midpoint)
server/queryCore.ts       # pure-JS int8 brute-force: neighbors + midpoint
api/query.ts              # Vercel serverless wrapper around queryCore
vite.config.ts            # dev middleware exposing /api/query locally
```

# book-vector web

React + react-three-fiber front end: a **galaxy** overview (2D/3D toggle) and a
dive-in **constellation** of a book's per-facet nearest neighbors, driven by
composable **facet lenses**.

```bash
npm install
npm run dev      # http://localhost:5173
```

## Data

Both artifacts are produced by the pipeline's `export` stage (gitignored):

- `public/data/galaxy.json` — coords + book metadata + cluster theme labels;
  the static galaxy loads this directly.
- `data/index.sqlite` — the per-facet `sqlite-vec` index behind live queries.
  In dev, a vite middleware serves `/api/query` from it with the same
  `server/queryCore.ts` the Vercel function uses; on Vercel it ships with the
  function via `vercel.json` `includeFiles`.

## Layout

```
src/
  App.tsx                 # galaxy ⇄ constellation mode switch
  components/
    Galaxy.tsx            # instanced point cloud (2D/3D), cluster colors, hover
    Constellation.tsx     # nearest neighbors + per-facet "why" chips
    FacetLens.tsx         # compose/weight facets for queries
    BookTooltip.tsx       # hover card (title, author, cluster theme)
  lib/api.ts              # client for the query function
server/queryCore.ts       # shared sqlite-vec weighted per-facet KNN
api/query.ts              # Vercel serverless wrapper around queryCore
vite.config.ts            # dev middleware exposing /api/query locally
```

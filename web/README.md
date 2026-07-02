# book-vector web

React + react-three-fiber front end: a **galaxy** overview (2D/3D toggle) and a
dive-in **constellation** of a book's per-facet nearest neighbors, driven by
composable **facet lenses**.

```bash
npm install
npm run dev      # http://localhost:5173
```

## Data

- `public/data/coords.json` — precomputed UMAP coords from the pipeline
  (`pipeline/data/coords.json`). Copy or symlink it here. Gitignored.
- Live per-facet + composed queries go to the serverless function in `api/`
  (backed by the pipeline's `index.sqlite`), per PLAN.md D9.

## Layout

```
src/
  App.tsx                 # galaxy ⇄ constellation mode switch
  components/
    Galaxy.tsx            # instanced point cloud (2D/3D)
    Constellation.tsx     # nearest-neighbor graph around a book
    FacetLens.tsx         # compose/weight facets to filter the galaxy
    BookTooltip.tsx       # hover card
  lib/api.ts              # client for the query function
api/query.ts              # Vercel serverless: sqlite-vec per-facet queries
```

# book-vector web

React + react-three-fiber front end. **Fully static** — every query runs in the
browser over precomputed assets, so there is no serverless function to fail or
hang (this replaced a flaky Vercel query function).

- **Galaxy** with a **lens toggle**: each lens (`all` + one per facet) is a
  separate precomputed UMAP layout; toggling reshapes the point cloud (animated)
  and re-ranks neighbors.
- **Constellation**: a book's nearest neighbors under the active lens — an
  instant lookup into a precomputed table.
- **Book-in-the-middle**: the book between any two, computed client-side over a
  small PCA-reduced vector file.
- **Hyperniche-genre sidebar**: click a theme to fly the camera to that cluster.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build && npm run preview   # serve the static build
```

## Data (produced by the pipeline's `export` stage; committed for Vercel)

- `public/data/galaxy.json` — book metadata, cluster theme labels, and the
  per-lens layouts (`layouts[lens]` aligned to `books`; `null` where a book is
  absent from that facet).
- `public/data/neighbors.bin` — per-lens top-K neighbor indices (uint16) + sims
  (uint8): all index blocks first (2-byte aligned), then the sim blocks.
- `public/data/midvec.bin` — int8 PCA-reduced concat vectors for the midpoint
  finder (loaded lazily on first use).

Regenerate with `pipeline/scripts/run_pipeline.py`.

## Layout

```
src/
  App.tsx                 # loads the store; owns active lens, mode, focus
  lib/data.ts             # static data layer: neighbors + midpoint in the browser
  components/
    Galaxy.tsx            # instanced points; animates between per-lens layouts
    LensToggle.tsx        # all / protagonist / relationship / arc / setting
    Sidebar.tsx           # lens toggle + book-in-the-middle + genre list
    Constellation.tsx     # precomputed nearest neighbors for the active lens
    BookPicker.tsx        # title autocomplete over the catalog
    BookTooltip.tsx       # hover card
```

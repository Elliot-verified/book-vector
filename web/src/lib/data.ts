// Client-side data layer. The app is fully static: it loads precomputed assets
// and answers all queries in the browser — there is no serverless function, so
// nothing can hang or fail at request time (this replaced the flaky Vercel
// query fn that got stuck on "loading").
//
//   galaxy.json   — metadata + per-lens layouts + cluster labels
//   neighbors.bin — per-lens top-K neighbor indices (uint16) + sims (uint8)
//   midvec.bin    — int8 PCA-reduced concat vectors (lazy; for the midpoint)

import type { GalaxyData, Lens, Midpoint, Neighbor } from "../types";

export interface Store {
  data: GalaxyData;
  index: Map<string, number>; // book id -> row
  n: number;
  k: number;
  neighborIdx: Record<string, Uint16Array>; // per lens, n*k
  neighborSim: Record<string, Uint8Array>; // per lens, n*k
  mid?: { vec: Int8Array; dim: number }; // loaded on first midpoint use
}

const NONE = 65535;

export async function loadStore(): Promise<Store> {
  const data: GalaxyData = await (await fetch("/data/galaxy.json")).json();
  const buf = await (await fetch("/data/neighbors.bin")).arrayBuffer();

  const n = data.books.length;
  const k = data.k;
  const perLens = n * k;
  const idxBytes = data.lenses.length * perLens * 2;

  const neighborIdx: Record<string, Uint16Array> = {};
  const neighborSim: Record<string, Uint8Array> = {};
  data.lenses.forEach((lens, li) => {
    neighborIdx[lens] = new Uint16Array(buf, li * perLens * 2, perLens);
    neighborSim[lens] = new Uint8Array(buf, idxBytes + li * perLens, perLens);
  });

  const index = new Map(data.books.map((b, i) => [b.id, i]));
  return { data, index, n, k, neighborIdx, neighborSim };
}

/** A book's precomputed nearest neighbors under a lens (instant lookup). */
export function neighborsOf(
  store: Store,
  bookId: string,
  lens: Lens,
  topN = 12,
): Neighbor[] {
  const row = store.index.get(bookId);
  if (row === undefined) return [];
  const idx = store.neighborIdx[lens];
  const sim = store.neighborSim[lens];
  const base = row * store.k;
  const out: Neighbor[] = [];
  for (let j = 0; j < store.k && out.length < topN; j++) {
    const ni = idx[base + j];
    if (ni === NONE) break;
    out.push({ id: store.data.books[ni].id, similarity: sim[base + j] / 255 });
  }
  return out;
}

/** Books between A and B in embedding space — computed in the browser over the
 *  reduced concat vectors (loaded on first use). */
export async function midpoint(
  store: Store,
  aId: string,
  bId: string,
  topN = 6,
): Promise<Midpoint[]> {
  const a = store.index.get(aId);
  const b = store.index.get(bId);
  if (a === undefined || b === undefined || a === b) return [];
  if (!store.mid) {
    const buf = await (await fetch("/data/midvec.bin")).arrayBuffer();
    store.mid = { vec: new Int8Array(buf), dim: store.data.midDim };
  }
  const { vec, dim } = store.mid;
  const dot = (i: number, j: number) => {
    let s = 0;
    const oi = i * dim;
    const oj = j * dim;
    for (let d = 0; d < dim; d++) s += vec[oi + d] * vec[oj + d];
    return s / (127 * 127);
  };

  const scored: { i: number; sa: number; sb: number }[] = [];
  for (let i = 0; i < store.n; i++) {
    if (i === a || i === b) continue;
    scored.push({ i, sa: dot(i, a), sb: dot(i, b) });
  }
  scored.sort((x, y) => y.sa + y.sb - (x.sa + x.sb));
  return scored.slice(0, topN).map((s) => ({
    id: store.data.books[s.i].id,
    similarity: (s.sa + s.sb) / 2,
    simToA: s.sa,
    simToB: s.sb,
  }));
}

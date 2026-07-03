// Pure-JS vector queries over the pipeline's int8 vector file. Shared by the
// Vercel function (api/query.ts) and the vite dev middleware, so dev and prod
// run the same code (PLAN.md D9/D10).
//
// No native modules — the earlier sqlite-vec / better-sqlite3 path failed to
// bundle on Vercel (the function crashed with "A server error has occurred").
// Vectors are unit-norm and int8-quantized (v*127), so cosine ≈ dot(qa,qb)/127²;
// L2-distance ordering is preserved and every query is exact brute force over a
// few thousand books — single-digit-to-tens-of-ms.

import path from "path";
import fs from "fs";

export const FACETS = [
  "protagonist",
  "relationship",
  "arc",
  "setting_as_device",
] as const;
export type Facet = (typeof FACETS)[number];

export interface NeighborResult {
  id: string;
  similarity: number;
  sharedFacets: Facet[];
  facetSims: Partial<Record<Facet, number>>;
}

export interface MidpointResult {
  id: string;
  similarity: number;
  simToA: number;
  simToB: number;
}

const SHARED_FACET_MIN_SIM = 0.6;

interface Store {
  ids: string[];
  index: Map<string, number>;
  facets: Facet[];
  dim: number;
  scale2: number;
  data: Int8Array; // book-major: [book][facet][dim]
  present: Uint8Array; // n*nf, 1 if that (book,facet) slice is non-empty
  n: number;
  stride: number; // facets*dim
}

let store: Store | null = null;

function resolvePath(name: string): string {
  const candidates = [
    process.env.BOOKVECTOR_DATA_DIR && path.join(process.env.BOOKVECTOR_DATA_DIR, name),
    path.join(process.cwd(), "data", name),
    path.join(process.cwd(), "..", "web", "data", name),
  ].filter(Boolean) as string[];
  for (const p of candidates) if (fs.existsSync(p)) return p;
  throw new Error(`${name} not found (tried: ${candidates.join(", ")})`);
}

function getStore(): Store {
  if (store) return store;
  const meta = JSON.parse(fs.readFileSync(resolvePath("vectors.meta.json"), "utf8"));
  const buf = fs.readFileSync(resolvePath("vectors.bin"));
  const data = new Int8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const facets: Facet[] = meta.facets;
  const dim: number = meta.dim;
  const n: number = meta.ids.length;
  const stride = facets.length * dim;

  const present = new Uint8Array(n * facets.length);
  for (let i = 0; i < n; i++) {
    for (let f = 0; f < facets.length; f++) {
      const off = i * stride + f * dim;
      let any = 0;
      for (let d = 0; d < dim; d++) if (data[off + d] !== 0) { any = 1; break; }
      present[i * facets.length + f] = any;
    }
  }

  store = {
    ids: meta.ids,
    index: new Map(meta.ids.map((id: string, i: number) => [id, i])),
    facets,
    dim,
    scale2: (meta.scale ?? 127) ** 2,
    data,
    present,
    n,
    stride,
  };
  return store;
}

function rowOf(s: Store, bookId: string): number {
  const i = s.index.get(String(bookId));
  if (i === undefined) throw new Error(`unknown book id: ${bookId}`);
  return i;
}

function has(s: Store, row: number, f: number): boolean {
  return s.present[row * s.facets.length + f] === 1;
}

/** cosine of two facet slices (rows `a`,`b`, facet index `f`). */
function cos(s: Store, a: number, b: number, f: number): number {
  const oa = a * s.stride + f * s.dim;
  const ob = b * s.stride + f * s.dim;
  const data = s.data;
  let dot = 0;
  for (let d = 0; d < s.dim; d++) dot += data[oa + d] * data[ob + d];
  return dot / s.scale2;
}

// -- neighbors -----------------------------------------------------------------

export function neighbors(
  bookId: string,
  weights: Partial<Record<Facet, number>>,
  k = 12,
): NeighborResult[] {
  const s = getStore();
  const seed = rowOf(s, bookId);

  const active = s.facets
    .map((f, fi) => ({ f, fi, w: weights[f] ?? 0 }))
    .filter((x) => x.w > 0 && has(s, seed, x.fi));
  const facets = active.length
    ? active
    : s.facets
        .map((f, fi) => ({ f, fi, w: 1 }))
        .filter((x) => x.f === "arc" && has(s, seed, x.fi));

  const sum = new Float64Array(s.n);
  const wsum = new Float64Array(s.n);
  const perFacet: Record<string, Float32Array> = {};
  for (const { f, fi, w } of facets) {
    const sims = new Float32Array(s.n);
    for (let j = 0; j < s.n; j++) {
      if (j === seed || !has(s, j, fi)) continue;
      const c = cos(s, seed, j, fi);
      sims[j] = c;
      sum[j] += w * c;
      wsum[j] += w;
    }
    perFacet[f] = sims;
  }

  const order = topK(sum, wsum, k, seed);
  return order.map((j) => {
    const facetSims: Partial<Record<Facet, number>> = {};
    const shared: Facet[] = [];
    for (const { f } of facets) {
      const c = perFacet[f][j];
      facetSims[f] = c;
      if (c >= SHARED_FACET_MIN_SIM) shared.push(f);
    }
    return { id: s.ids[j], similarity: wsum[j] ? sum[j] / wsum[j] : 0, sharedFacets: shared, facetSims };
  });
}

// -- midpoint: the book "in the middle" of two others --------------------------
// Ranks by combined closeness to A and B — for unit facet vectors this is the
// book nearest the cosine-midpoint (maximizing cand·A + cand·B).

export function midpoint(bookA: string, bookB: string, k = 8): MidpointResult[] {
  const s = getStore();
  const rA = rowOf(s, bookA);
  const rB = rowOf(s, bookB);
  if (rA === rB) throw new Error("pick two different books");

  const facets = s.facets
    .map((_, fi) => fi)
    .filter((fi) => has(s, rA, fi) && has(s, rB, fi));
  const nf = facets.length || 1;

  const accA = new Float64Array(s.n);
  const accB = new Float64Array(s.n);
  for (const fi of facets) {
    for (let j = 0; j < s.n; j++) {
      if (!has(s, j, fi)) continue;
      accA[j] += cos(s, rA, j, fi);
      accB[j] += cos(s, rB, j, fi);
    }
  }

  const score = new Float64Array(s.n);
  for (let j = 0; j < s.n; j++) score[j] = accA[j] + accB[j];

  return topK(score, null, k, rA, rB).map((j) => {
    const simToA = accA[j] / nf;
    const simToB = accB[j] / nf;
    return { id: s.ids[j], similarity: (simToA + simToB) / 2, simToA, simToB };
  });
}

/** indices of the k largest sum[j]/(wsum?wsum[j]:1), excluding `skip*`. */
function topK(
  sum: Float64Array,
  wsum: Float64Array | null,
  k: number,
  ...skip: number[]
): number[] {
  const skipSet = new Set(skip);
  const scored: { j: number; v: number }[] = [];
  for (let j = 0; j < sum.length; j++) {
    if (skipSet.has(j)) continue;
    const w = wsum ? wsum[j] : 1;
    if (w === 0) continue;
    scored.push({ j, v: sum[j] / (wsum ? w : 1) });
  }
  scored.sort((a, b) => b.v - a.v);
  return scored.slice(0, k).map((x) => x.j);
}

// -- dispatcher shared by the Vercel fn and the dev middleware -----------------

export function handleQuery(body: {
  op?: string;
  bookId?: string;
  weights?: Partial<Record<Facet, number>>;
  bookA?: string;
  bookB?: string;
  k?: number;
}): object {
  if (body.op === "midpoint") {
    return { results: midpoint(body.bookA!, body.bookB!, body.k ?? 8) };
  }
  return { neighbors: neighbors(body.bookId!, body.weights ?? {}, body.k ?? 12) };
}

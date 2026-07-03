// Core query logic over the pipeline's sqlite-vec index. Shared by the Vercel
// function (api/query.ts) and the vite dev middleware, so dev and prod run the
// same code (PLAN.md D9/D10).
//
// Vectors are L2-normalized, so vec0's L2 distance ranks identically to cosine
// and cosine = 1 - d²/2. At ~2k books we ask for every row (exact brute force,
// D10).

import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
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

/** A book that sits "between" two others in embedding space. */
export interface MidpointResult {
  id: string;
  similarity: number; // mean of simToA and simToB
  simToA: number;
  simToB: number;
}

const SHARED_FACET_MIN_SIM = 0.6;

let db: Database.Database | null = null;

function resolveDbPath(): string {
  const candidates = [
    process.env.BOOKVECTOR_INDEX,
    path.join(process.cwd(), "data", "index.sqlite"),
    path.join(process.cwd(), "..", "pipeline", "data", "index.sqlite"),
  ].filter(Boolean) as string[];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`index.sqlite not found (tried: ${candidates.join(", ")})`);
}

function getDb(): Database.Database {
  if (!db) {
    db = new Database(resolveDbPath(), { readonly: true });
    sqliteVec.load(db);
  }
  return db;
}

function rowidOf(bookId: string): number {
  const row = getDb()
    .prepare("SELECT rowid FROM books WHERE book_id = ?")
    .get(String(bookId)) as { rowid: number } | undefined;
  if (!row) throw new Error(`unknown book id: ${bookId}`);
  return row.rowid;
}

function bookCount(): number {
  return (getDb().prepare("SELECT COUNT(*) AS n FROM books").get() as { n: number }).n;
}

function facetVec(facet: Facet, rowid: number): Buffer | null {
  const q = getDb()
    .prepare(`SELECT embedding FROM vec_${facet} WHERE rowid = ?`)
    .get(rowid) as { embedding: Buffer } | undefined;
  return q ? q.embedding : null;
}

const idStmt = () => getDb().prepare("SELECT book_id FROM books WHERE rowid = ?");
function idOf(rowid: number): string {
  return (idStmt().get(rowid) as { book_id: string }).book_id;
}

// -- neighbors: per-facet + weighted-composed nearest neighbors of one book ----

export function neighbors(
  bookId: string,
  weights: Partial<Record<Facet, number>>,
  k = 12,
): NeighborResult[] {
  const d = getDb();
  const rowid = rowidOf(bookId);
  const active = FACETS.filter((f) => (weights[f] ?? 0) > 0);
  const facets = active.length ? active : (["arc"] as Facet[]);
  const total = bookCount();

  const scores = new Map<
    number,
    { sum: number; wsum: number; sims: Partial<Record<Facet, number>> }
  >();
  for (const facet of facets) {
    const w = weights[facet] ?? 1;
    const emb = facetVec(facet, rowid);
    if (!emb) continue; // query book has no signal in this facet

    const hits = d
      .prepare(`SELECT rowid, distance FROM vec_${facet} WHERE embedding MATCH ? AND k = ?`)
      .all(emb, total) as { rowid: number; distance: number }[];
    for (const hit of hits) {
      if (hit.rowid === rowid) continue;
      const sim = 1 - (hit.distance * hit.distance) / 2;
      const entry = scores.get(hit.rowid) ?? { sum: 0, wsum: 0, sims: {} };
      entry.sum += w * sim;
      entry.wsum += w;
      entry.sims[facet] = sim;
      scores.set(hit.rowid, entry);
    }
  }

  return [...scores.entries()]
    .map(([rowid, e]) => ({ rowid, similarity: e.wsum ? e.sum / e.wsum : 0, ...e }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k)
    .map((e) => ({
      id: idOf(e.rowid),
      similarity: e.similarity,
      sharedFacets: facets.filter((f) => (e.sims[f] ?? 0) >= SHARED_FACET_MIN_SIM),
      facetSims: e.sims,
    }));
}

// -- midpoint: the book "in the middle" of two others --------------------------
//
// For unit facet vectors, the book nearest the cosine-midpoint of A and B is the
// one maximizing cand·(A+B) = cand·A + cand·B — i.e. the book most similar to
// *both*. So we accumulate each candidate's summed per-facet cosine to A and to
// B (over the facets both A and B have) and rank by the total. This reuses the
// per-facet tables — no separate concat index needed.

function accumulate(seedRowid: number, facets: Facet[], total: number): Map<number, number> {
  const d = getDb();
  const m = new Map<number, number>();
  for (const f of facets) {
    const emb = facetVec(f, seedRowid);
    if (!emb) continue;
    const hits = d
      .prepare(`SELECT rowid, distance FROM vec_${f} WHERE embedding MATCH ? AND k = ?`)
      .all(emb, total) as { rowid: number; distance: number }[];
    for (const h of hits) {
      m.set(h.rowid, (m.get(h.rowid) ?? 0) + (1 - (h.distance * h.distance) / 2));
    }
  }
  return m;
}

export function midpoint(bookA: string, bookB: string, k = 8): MidpointResult[] {
  const rA = rowidOf(bookA);
  const rB = rowidOf(bookB);
  if (rA === rB) throw new Error("pick two different books");

  // only facets both books actually have contribute to the midpoint
  const facets = FACETS.filter((f) => facetVec(f, rA) && facetVec(f, rB));
  const nf = facets.length || 1;
  const total = bookCount();

  const accA = accumulate(rA, facets, total);
  const accB = accumulate(rB, facets, total);

  const rows = new Set<number>([...accA.keys(), ...accB.keys()]);
  const out: MidpointResult[] = [];
  for (const rid of rows) {
    if (rid === rA || rid === rB) continue;
    const simToA = (accA.get(rid) ?? 0) / nf;
    const simToB = (accB.get(rid) ?? 0) / nf;
    out.push({ id: "", similarity: (simToA + simToB) / 2, simToA, simToB, _rid: rid } as any);
  }
  return out
    .sort((a, b) => b.simToA + b.simToB - (a.simToA + a.simToB))
    .slice(0, k)
    .map((r) => ({
      id: idOf((r as any)._rid),
      similarity: r.similarity,
      simToA: r.simToA,
      simToB: r.simToB,
    }));
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

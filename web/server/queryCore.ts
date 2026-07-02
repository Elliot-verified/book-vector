// Core per-facet nearest-neighbor logic over the pipeline's sqlite-vec index.
// Shared by the Vercel function (api/query.ts) and the vite dev middleware, so
// dev and prod run the same code (PLAN.md D9/D10).
//
// Vectors are L2-normalized, so vec0's L2 distance ranks identically to cosine
// and cosine = 1 - d²/2. At ~2k books we ask for every row (exact brute force,
// D10) and combine facets by the requested weights.

import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import path from "path";
import fs from "fs";

export const FACETS = [
  "protagonist",
  "relationship",
  "arc",
  "setting_as_device",
  "twist",
] as const;
export type Facet = (typeof FACETS)[number];

export interface NeighborResult {
  id: string;
  similarity: number;
  sharedFacets: Facet[];
  facetSims: Partial<Record<Facet, number>>;
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

export function neighbors(
  bookId: string,
  weights: Partial<Record<Facet, number>>,
  k = 12,
): NeighborResult[] {
  const d = getDb();
  const row = d
    .prepare("SELECT rowid FROM books WHERE book_id = ?")
    .get(String(bookId)) as { rowid: number } | undefined;
  if (!row) throw new Error(`unknown book id: ${bookId}`);

  const active = FACETS.filter((f) => (weights[f] ?? 0) > 0);
  const facets = active.length ? active : (["arc"] as Facet[]);
  const total = d.prepare("SELECT COUNT(*) AS n FROM books").get() as { n: number };

  const scores = new Map<number, { sum: number; wsum: number; sims: Partial<Record<Facet, number>> }>();
  for (const facet of facets) {
    const w = weights[facet] ?? 1;
    const q = d
      .prepare(`SELECT embedding FROM vec_${facet} WHERE rowid = ?`)
      .get(row.rowid) as { embedding: Buffer } | undefined;
    if (!q) continue; // query book has no signal in this facet

    const hits = d
      .prepare(
        `SELECT rowid, distance FROM vec_${facet} WHERE embedding MATCH ? AND k = ?`,
      )
      .all(q.embedding, total.n) as { rowid: number; distance: number }[];
    for (const hit of hits) {
      if (hit.rowid === row.rowid) continue;
      const sim = 1 - (hit.distance * hit.distance) / 2;
      const entry = scores.get(hit.rowid) ?? { sum: 0, wsum: 0, sims: {} };
      entry.sum += w * sim;
      entry.wsum += w;
      entry.sims[facet] = sim;
      scores.set(hit.rowid, entry);
    }
  }

  const idOf = d.prepare("SELECT book_id FROM books WHERE rowid = ?");
  return [...scores.entries()]
    .map(([rowid, e]) => ({ rowid, similarity: e.wsum ? e.sum / e.wsum : 0, ...e }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k)
    .map((e) => ({
      id: (idOf.get(e.rowid) as { book_id: string }).book_id,
      similarity: e.similarity,
      sharedFacets: facets.filter((f) => (e.sims[f] ?? 0) >= SHARED_FACET_MIN_SIM),
      facetSims: e.sims,
    }));
}

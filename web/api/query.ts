// Vercel serverless function: per-facet + composed nearest-neighbor queries
// against the pipeline's sqlite-vec index (PLAN.md D9/D10).
//
// Request:  { bookId: string, weights: Record<Facet, number>, k?: number }
// Response: { neighbors: { id, similarity, sharedFacets, facetSims }[] }
//
// The actual query logic lives in server/queryCore.ts, shared with the vite
// dev middleware. index.sqlite ships with the function via vercel.json's
// includeFiles (web/data/index.sqlite, copied there by the export stage).

import { neighbors, type Facet } from "../server/queryCore";

export const config = { runtime: "nodejs" };

interface QueryBody {
  bookId: string;
  weights: Partial<Record<Facet, number>>;
  k?: number;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }
  try {
    const { bookId, weights = {}, k = 12 } = (await req.json()) as QueryBody;
    return new Response(JSON.stringify({ neighbors: neighbors(bookId, weights, k) }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
}

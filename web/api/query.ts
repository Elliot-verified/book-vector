// Vercel serverless function: per-facet + composed nearest-neighbor queries
// against the pipeline's sqlite-vec index (PLAN.md D9/D10).
//
// Request:  { bookId: string, weights: Record<Facet, number>, k?: number }
// Response: { neighbors: { id, similarity, sharedFacets }[] }
//
// At a few thousand books this is exact brute-force cosine per facet, combined
// by the requested weights. TODO: wire up better-sqlite3 + sqlite-vec, load
// index.sqlite (bundled or from blob storage), and implement the weighted combine.

export const config = { runtime: "nodejs" };

interface QueryBody {
  bookId: string;
  weights: Record<string, number>;
  k?: number;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }
  const { bookId, weights, k = 12 } = (await req.json()) as QueryBody;

  // TODO: for each facet with weight > 0, run a KNN over vec_<facet> seeded by
  // bookId's vector; combine scores by weight; return the top-k with the facets
  // that contributed most as `sharedFacets`.
  void bookId;
  void weights;
  void k;

  return new Response(
    JSON.stringify({ neighbors: [], note: "query fn not yet implemented" }),
    { headers: { "content-type": "application/json" } },
  );
}

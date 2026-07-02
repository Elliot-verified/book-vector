import type { FacetWeights, Neighbor } from "../types";

// Client for the serverless query function (api/query.ts). Per-facet and
// composed (weighted) nearest-neighbor lookups against the sqlite-vec index.

export async function neighbors(
  bookId: string,
  weights: FacetWeights,
  k = 12,
): Promise<Neighbor[]> {
  const res = await fetch("/api/query", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ bookId, weights, k }),
  });
  if (!res.ok) throw new Error(`query failed: ${res.status}`);
  const data = await res.json();
  return data.neighbors as Neighbor[];
}

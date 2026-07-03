import type { FacetWeights, Midpoint, Neighbor } from "../types";

// Client for the serverless query function (api/query.ts). Per-facet composed
// nearest-neighbor lookups and the "book in the middle of two" midpoint query,
// both against the sqlite-vec index.

export async function neighbors(
  bookId: string,
  weights: FacetWeights,
  k = 12,
): Promise<Neighbor[]> {
  const data = await post({ bookId, weights, k });
  return data.neighbors as Neighbor[];
}

export async function midpoint(bookA: string, bookB: string, k = 8): Promise<Midpoint[]> {
  const data = await post({ op: "midpoint", bookA, bookB, k });
  return data.results as Midpoint[];
}

async function post(body: unknown): Promise<any> {
  const res = await fetch("/api/query", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `query failed: ${res.status}`);
  return data;
}

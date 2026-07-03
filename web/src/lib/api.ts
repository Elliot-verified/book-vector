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
  // Read as text first: on an infra-level failure the body may be a plain-text
  // error page (e.g. Vercel's "A server error has occurred"), not JSON —
  // parsing that directly is what produced the "Unexpected token 'A'" error.
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`query failed (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) throw new Error(data.error ?? `query failed: ${res.status}`);
  return data;
}

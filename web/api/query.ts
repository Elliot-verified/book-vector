// Vercel serverless function: nearest-neighbor + midpoint queries against the
// pipeline's sqlite-vec index (PLAN.md D9/D10).
//
// Request (neighbors): { bookId, weights, k? }
// Request (midpoint):  { op: "midpoint", bookA, bookB, k? }
//
// The query logic lives in server/queryCore.ts, shared with the vite dev
// middleware. index.sqlite ships with the function via vercel.json includeFiles.

import { handleQuery } from "../server/queryCore";

export const config = { runtime: "nodejs" };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }
  try {
    const body = await req.json();
    return new Response(JSON.stringify(handleQuery(body)), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
}

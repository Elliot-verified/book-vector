// Vercel serverless function: nearest-neighbor + midpoint queries against the
// pipeline's int8 vector file (PLAN.md D9/D10). Pure JS — no native modules.
//
// Request (neighbors): { bookId, weights, k? }
// Request (midpoint):  { op: "midpoint", bookA, bookB, k? }
//
// queryCore is imported dynamically *inside* the handler so that even a
// load-time failure is caught and returned as JSON, rather than surfacing as
// Vercel's opaque "A server error has occurred" page.

export const config = { runtime: "nodejs" };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }
  try {
    const { handleQuery } = await import("../server/queryCore");
    const body = await req.json();
    return new Response(JSON.stringify(handleQuery(body)), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
}

import { defineConfig, type Plugin } from "vite";

// react-three-fiber works with the default esbuild JSX pipeline; no plugin
// needed for a minimal setup. Add @vitejs/plugin-react if you want Fast Refresh.

// Dev-only /api/query endpoint running the same queryCore as the Vercel fn,
// so `vite dev` exercises the real sqlite-vec index.
function devApi(): Plugin {
  return {
    name: "book-vector-dev-api",
    configureServer(server) {
      server.middlewares.use("/api/query", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          return res.end("method not allowed");
        }
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", async () => {
          try {
            const { neighbors } = await import("./server/queryCore");
            const { bookId, weights = {}, k = 12 } = JSON.parse(body);
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ neighbors: neighbors(bookId, weights, k) }));
          } catch (e) {
            res.statusCode = 400;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ error: String(e) }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  server: { port: 5173 },
  plugins: [devApi()],
});

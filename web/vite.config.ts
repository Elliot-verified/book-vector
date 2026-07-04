import { defineConfig } from "vite";

// The app is fully static — all queries run client-side over precomputed assets
// (see src/lib/data.ts), so there is no dev API middleware and no serverless
// function. `vite build` produces a plain static site.
export default defineConfig({
  server: { port: 5173 },
});

import { defineConfig } from "vite";

// react-three-fiber works with the default esbuild JSX pipeline; no plugin
// needed for a minimal setup. Add @vitejs/plugin-react if you want Fast Refresh.
export default defineConfig({
  server: { port: 5173 },
});

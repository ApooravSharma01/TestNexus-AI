import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The suite runner saves its last answer in public/ for local development.
// It must never ship with a hosted build, or visitors would see old runs.
function dropSavedRuns() {
  let outDir = "";

  return {
    name: "drop-saved-runs",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      await rm(resolve(outDir, "suite-runs.json"), { force: true });
    }
  };
}

export default defineConfig({
  plugins: [react(), dropSavedRuns()],
  server: {
    port: 5173,
    // The suite runner API is a separate local process (npm run suites:server).
    proxy: {
      "/api": "http://127.0.0.1:4000"
    },
    // The runner rewrites this file on every refresh. Ignoring it stops the page from reloading each time.
    watch: {
      ignored: ["**/public/suite-runs.json"]
    }
  }
});

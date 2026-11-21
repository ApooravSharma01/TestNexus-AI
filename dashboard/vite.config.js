import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The suite runner API is a separate local process (npm run suites:server).
    proxy: {
      "/api": "http://127.0.0.1:4000"
    }
  }
});

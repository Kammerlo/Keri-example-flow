import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [react(), wasm(), nodePolyfills()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
      "/oobi": "http://localhost:3001",
    },
  },
  build: { target: "esnext" },
});

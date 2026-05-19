import { defineConfig } from "vitest/config";

// Live-stack end-to-end run (requires `docker compose up`).
export default defineConfig({
  test: {
    include: ["test/**/*.e2e.test.ts"],
    testTimeout: 300_000,
    hookTimeout: 300_000,
  },
});

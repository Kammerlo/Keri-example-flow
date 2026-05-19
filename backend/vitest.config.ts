import { defineConfig } from "vitest/config";

// Default unit/contract run — excludes the live-stack e2e suite.
export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/*.e2e.test.ts"],
  },
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: ["src/**/*.ts"],
      // The DOM player is covered by the Playwright smoke test.
      exclude: ["src/player.ts"],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});

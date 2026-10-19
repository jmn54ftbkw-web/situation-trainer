import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: ["src/**/*.ts"],
      exclude: ["src/cli/**", "src/bank.generated.ts"],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});

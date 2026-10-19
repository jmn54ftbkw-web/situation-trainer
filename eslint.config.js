import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/node_modules/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "legacy/**",
      ".turbo/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}", "packages/field/**/*.ts", "packages/data/**/*.ts"],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ["apps/web/**/*.tsx"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    // The engine and content packages must stay DOM-free (ADR 0002).
    files: ["packages/engine/src/**/*.ts", "packages/content/src/**/*.ts"],
    rules: {
      "no-restricted-globals": ["error", "window", "document", "localStorage", "requestAnimationFrame"],
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
);

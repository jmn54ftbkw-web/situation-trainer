import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves the app from /situation-trainer/; local dev uses "/".
export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  plugins: [react()],
  build: {
    target: "es2022",
    sourcemap: false,
  },
});

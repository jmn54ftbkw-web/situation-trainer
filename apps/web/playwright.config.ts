import { defineConfig, devices } from "@playwright/test";

const shots = !!process.env.SCREENSHOT_DIR;

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:4173/situation-trainer/",
    ...devices["iPhone 13"],
    browserName: "chromium",
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
  },
  webServer: [
    {
      // Serve the production build under the same base path GitHub Pages uses.
      command: "export VITE_BASE=/situation-trainer/ && pnpm build && pnpm preview",
      url: "http://127.0.0.1:4173/situation-trainer/",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    ...(shots
      ? [
          {
            command: "python3 -m http.server 4174 --bind 127.0.0.1",
            cwd: "../../legacy/prototype",
            url: "http://127.0.0.1:4174/",
            reuseExistingServer: true,
          },
        ]
      : []),
  ],
});

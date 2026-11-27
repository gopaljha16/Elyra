import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/fixtures",
  testMatch: "dashboard.spec.ts",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3117",
    reducedMotion: "reduce",
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
  },
  webServer: {
    command: "bun tests/fixtures/serve.mjs",
    url: "http://127.0.0.1:3117",
    reuseExistingServer: false,
  },
});

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testIgnore: "**/fixtures/**",
  testDir: "./tests",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3100",
    headless: true,
  },
  webServer: {
    command: "bun run start -- -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "dummy",
    },
  },
});

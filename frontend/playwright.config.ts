import { defineConfig, devices } from "@playwright/test";

/**
 * Drives the real UI against a running stack (`docker compose up`), which is
 * the one layer the unit and contract tests can't reach: they mock the
 * client or speak straight to the API, so nothing else would notice if the
 * keypad itself stopped being wired up.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // The responsive layout has only ever been checked by eye until now.
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
});

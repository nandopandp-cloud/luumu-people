import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

/** E2E contra o app real, com banco PGlite próprio (semeado automaticamente). */
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/warmup.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", navigationTimeout: 45_000 },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, grepInvert: /@mobile/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
  webServer: {
    command: `pnpm next dev --port ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      // Em memória: recriado a cada execução e fora da árvore observada pelo dev server.
      DATABASE_URL: "pglite://memory",
      APP_URL: `http://localhost:${PORT}`,
      BETTER_AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-e2e-0000",
      SEED_PASSWORD: "Luumu@Demo2026",
      LOG_LEVEL: "warn",
    },
  },
});

import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

/**
 * E2E contra o app real, com banco PGlite próprio (semeado automaticamente).
 * Não rode `pnpm dev` ao mesmo tempo: dois servidores de dev no mesmo projeto
 * reescrevem os arquivos gerados um do outro e entram em loop de recarga.
 */
export default defineConfig({
  testDir: "tests/e2e",
  // Fora do projeto: o dev server observa a raiz, e cada trace/screenshot
  // gravado em ./test-results disparava recompilação e recarregava a página em loop.
  outputDir: path.join(tmpdir(), "luumu-people-e2e"),
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
      // Muitos logins seguidos do mesmo IP nos testes; em produção o padrão é 10/min.
      AUTH_SIGNIN_RATE_LIMIT: "200",
      APP_URL: `http://localhost:${PORT}`,
      BETTER_AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-e2e-0000",
      SEED_PASSWORD: "Luumu@Demo2026",
      LOG_LEVEL: "warn",
    },
  },
});

import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import base from "../../playwright.config";

/**
 * Capturas de tela da documentação (docs/product.md), com o app real e o seed
 * demonstrativo. Mesmo servidor do E2E; não rode junto com `pnpm dev`.
 *
 *   pnpm docs:screenshots
 */
export default defineConfig({
  ...base,
  testDir: ".",
  globalSetup: undefined,
  timeout: 600_000,
  use: { ...base.use, navigationTimeout: 180_000 },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, grepInvert: /@mobile/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
  // O comando do servidor roda na raiz do projeto, não nesta pasta.
  webServer: { ...(base.webServer as object), cwd: path.resolve(__dirname, "../..") } as typeof base.webServer,
});

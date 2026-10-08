import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // `server-only` lança fora do bundler do Next; nos testes é um no-op.
      "server-only": path.resolve(root, "tests/support/empty-module.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    setupFiles: ["tests/support/setup-env.ts"],
    // PGlite em memória por processo: cada arquivo de teste tem seu próprio banco.
    pool: "forks",
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});

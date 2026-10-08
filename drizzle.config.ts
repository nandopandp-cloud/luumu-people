import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit só GERA migrations a partir do schema (snapshot), sem tocar no banco.
 * A aplicação das migrations é feita por scripts/db-migrate.ts, com a role dona do
 * schema (DATABASE_URL_MIGRATIONS) — nunca com as roles de runtime.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./db/migrations",
  strict: true,
  verbose: true,
});

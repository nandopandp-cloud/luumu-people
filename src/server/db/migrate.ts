import path from "node:path";
import type { Database } from "./client";

export const MIGRATIONS_FOLDER = path.join(process.cwd(), "db/migrations");

/**
 * Aplica as migrations versionadas em db/migrations. Deve rodar com a role dona
 * do schema (superusuário no PGlite; DATABASE_URL_MIGRATIONS no Neon).
 */
export async function migrateDatabase(db: Database, driver: "pglite" | "pg"): Promise<void> {
  if (driver === "pglite") {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db as Parameters<typeof migrate>[0], { migrationsFolder: MIGRATIONS_FOLDER });
  } else {
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    await migrate(db as Parameters<typeof migrate>[0], { migrationsFolder: MIGRATIONS_FOLDER });
  }
}

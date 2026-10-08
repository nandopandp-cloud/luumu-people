import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/server/db/schema";
import type { Database } from "../src/server/db/client";

config({ path: [".env.local", ".env"], quiet: true });

/**
 * Conexão com a role DONA do schema (somente CLI). Nunca configure
 * DATABASE_URL_MIGRATIONS na Vercel: o runtime usa logins sem privilégios de dono.
 */
export function ownerDatabase(): { db: Database; pool: Pool } {
  const url = process.env.DATABASE_URL_MIGRATIONS;
  if (!url) {
    console.error("Defina DATABASE_URL_MIGRATIONS (role dona do schema, ex.: neondb_owner, endpoint direto/sem pooler).");
    process.exit(1);
  }
  if (url.startsWith("pglite://")) {
    console.error("PGlite se migra sozinho ao iniciar a aplicação; estes scripts são para Postgres/Neon.");
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url, max: 1 });
  return { db: drizzle({ client: pool, schema }) as unknown as Database, pool };
}
export { schema };

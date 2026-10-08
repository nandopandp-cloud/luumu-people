import { migrateDatabase } from "../src/server/db/migrate";
import { syncCatalog } from "../src/server/db/seed";
import { ownerDatabase } from "./_db";

/** Aplica migrations versionadas e sincroniza catálogo (permissões e feature flags). */
const { db, pool } = ownerDatabase();
try {
  await migrateDatabase(db, "pg");
  await syncCatalog(db);
  console.log("✓ Migrations aplicadas e catálogo sincronizado.");
} finally {
  await pool.end();
}

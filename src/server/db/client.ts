import "server-only";
import type { PGlite } from "@electric-sql/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import { env } from "@/server/env";
import * as schema from "./schema";

export type Schema = typeof schema;
export type Database = PgDatabase<PgQueryResultHKT, Schema>;

/**
 * Conexões de banco. Dois clientes com roles diferentes:
 *  - app:  DATABASE_URL       → login membro de luumu_app (dados de negócio, RLS por tenant)
 *  - auth: DATABASE_URL_AUTH  → login membro de luumu_auth (tabelas do Better Auth)
 *
 * Em desenvolvimento/teste, `pglite://<dir>` ou `pglite://memory` usa Postgres
 * embarcado (WASM). Um único processo PGlite atende ambos os clientes; o
 * isolamento por role continua garantido em withTenant via SET LOCAL ROLE.
 *
 * Este módulo NÃO deve ser importado por módulos de domínio — use withTenant()
 * (src/server/db/tenant.ts). A regra é verificada pelo ESLint.
 */

type Clients = { app: Database; auth: Database; pglite?: PGlite; pools: Pool[] };

/** Senha das contas demonstrativas no PGlite local. Nunca usada fora de desenvolvimento. */
export const DEV_SEED_PASSWORD = "Luumu@Demo2026";

const globalKey = Symbol.for("luumu.db.clients");
type GlobalWithDb = typeof globalThis & { [globalKey]?: Promise<Clients> };

async function createPglite(url: string): Promise<{ db: Database; pglite: PGlite }> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const location = url.replace("pglite://", "");
  if (location !== "memory") {
    const { mkdirSync } = await import("node:fs");
    mkdirSync(location, { recursive: true });
  }
  const pglite = location === "memory" ? new PGlite() : new PGlite(location);
  await pglite.waitReady;
  return { db: drizzle({ client: pglite, schema }) as unknown as Database, pglite };
}

async function createPg(url: string, maxConnections: number): Promise<{ db: Database; pool: Pool }> {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const pool = new Pool({
    connectionString: url,
    max: maxConnections,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: url.includes("sslmode=disable") ? false : { rejectUnauthorized: true },
  });
  return { db: drizzle({ client: pool, schema }) as unknown as Database, pool };
}

async function createClients(): Promise<Clients> {
  const { DATABASE_URL, DATABASE_URL_AUTH, NODE_ENV } = env();
  if (DATABASE_URL.startsWith("pglite://")) {
    const { db, pglite } = await createPglite(DATABASE_URL);
    // Desenvolvimento local sem configuração: o PGlite se auto-migra e, se vazio,
    // recebe os dados demonstrativos. Testes controlam o próprio seed.
    const { migrateDatabase } = await import("./migrate");
    await migrateDatabase(db, "pglite");
    if (NODE_ENV === "development") {
      const { isDatabaseEmpty, seedDemo } = await import("./seed");
      if (await isDatabaseEmpty(db)) await seedDemo(db, process.env.SEED_PASSWORD ?? DEV_SEED_PASSWORD);
    }
    return { app: db, auth: db, pglite, pools: [] };
  }
  if (!DATABASE_URL_AUTH) {
    throw new Error("DATABASE_URL_AUTH é obrigatória com Postgres (role luumu_auth).");
  }
  const app = await createPg(DATABASE_URL, 5);
  const auth = await createPg(DATABASE_URL_AUTH, 3);
  return { app: app.db, auth: auth.db, pools: [app.pool, auth.pool] };
}

function clients(): Promise<Clients> {
  const g = globalThis as GlobalWithDb;
  g[globalKey] ??= createClients().catch((error) => {
    delete g[globalKey];
    throw error;
  });
  return g[globalKey];
}

/** @internal — use withTenant()/withAuthRole(). */
export async function appDb(): Promise<Database> {
  return (await clients()).app;
}

/** @internal — exclusivo do Better Auth. */
export async function authDb(): Promise<Database> {
  return (await clients()).auth;
}

/** @internal — testes e scripts: acesso ao PGlite subjacente (superusuário). */
export async function pgliteInstance(): Promise<PGlite | undefined> {
  return (await clients()).pglite;
}

/** Fecha conexões (scripts e testes). */
export async function closeDb(): Promise<void> {
  const g = globalThis as GlobalWithDb;
  const pending = g[globalKey];
  if (!pending) return;
  delete g[globalKey];
  const c = await pending;
  await Promise.all(c.pools.map((p) => p.end()));
  await c.pglite?.close();
}

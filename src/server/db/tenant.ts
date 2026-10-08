import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { appDb, type Database } from "./client";

export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Contexto de tenant. É derivado EXCLUSIVAMENTE da sessão autenticada —
 * nunca de parâmetros do request (ver src/server/http/route.ts).
 */
export type TenantContext = {
  readonly tenantId: string;
  readonly userId: string | null;
};

const uuid = z.uuid();

/**
 * Executa `fn` numa transação com:
 *   SET LOCAL ROLE luumu_app         → nenhuma escapatória de RLS, mesmo em PGlite (superusuário)
 *   SET LOCAL app.tenant_id = <id>   → policies de RLS filtram por tenant
 *
 * Os valores são locais à transação, portanto seguros com pooling em modo transação
 * (pooler do Neon/PgBouncer).
 */
export async function withTenant<T>(ctx: TenantContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const tenantId = uuid.parse(ctx.tenantId);
  const db = await appDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local role luumu_app`);
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    return fn(tx);
  });
}

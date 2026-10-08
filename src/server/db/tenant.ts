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
 *   SET LOCAL app.user_id = <id>     → policies de dados pessoais (só o titular)
 *
 * Os valores são locais à transação, portanto seguros com pooling em modo transação
 * (pooler do Neon/PgBouncer).
 */
export async function withTenant<T>(ctx: TenantContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const tenantId = uuid.parse(ctx.tenantId);
  const db = await appDb();
  return db.transaction(async (tx) => {
    // Uma única ida ao banco: role de runtime + tenant + usuário (este último
    // usado por policies de dados estritamente pessoais, ex.: check-in de humor).
    await tx.execute(sql`select
      set_config('role', 'luumu_app', true),
      set_config('app.tenant_id', ${tenantId}, true),
      set_config('app.user_id', ${ctx.userId ? uuid.parse(ctx.userId) : ""}, true)`);
    return fn(tx);
  });
}

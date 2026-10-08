import { sql } from "drizzle-orm";
import { appDb, type Database } from "@/server/db/client";
import { seedDemo, type SeedResult } from "@/server/db/seed";

export const TEST_PASSWORD = "Teste@Seguro2026";

let seeded: Promise<{ db: Database; seed: SeedResult }> | undefined;

/** Banco PGlite em memória (migrado automaticamente) + dados demonstrativos. Um por arquivo de teste. */
export function testDatabase() {
  seeded ??= (async () => {
    const db = await appDb();
    const seed = await seedDemo(db, TEST_PASSWORD);
    return { db, seed };
  })();
  return seeded;
}

export async function tenantOf(slug: string) {
  const { seed } = await testDatabase();
  const org = seed.get(slug);
  if (!org) throw new Error(`tenant ${slug} não semeado`);
  return org;
}

export async function userOf(slug: string, key: string) {
  const org = await tenantOf(slug);
  const user = org.users.get(key);
  if (!user) throw new Error(`usuário ${key} não encontrado em ${slug}`);
  return { ...user, tenantId: org.tenantId };
}

/** Executa SQL como uma role específica, sem contexto de tenant (para testar o "fail closed"). */
export async function asRole<T>(role: "luumu_app" | "luumu_auth", fn: (db: Database) => Promise<T>): Promise<T> {
  const { db } = await testDatabase();
  return db.transaction(async (tx) => {
    await tx.execute(sql.raw(`set local role ${role}`));
    return fn(tx as unknown as Database);
  });
}

/** O Drizzle encapsula o erro do Postgres em `cause`; verifica a mensagem original. */
export async function expectDbError(promise: Promise<unknown>, pattern: RegExp): Promise<void> {
  let caught: unknown;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  if (!caught) throw new Error(`Era esperado um erro de banco compatível com ${pattern}, mas a operação foi aceita.`);
  const messages: string[] = [];
  // O PGlite lança objetos de erro que não herdam de Error neste realm.
  for (let e: unknown = caught; e && typeof e === "object" && "message" in e; e = (e as { cause?: unknown }).cause) {
    messages.push(String((e as { message: unknown }).message));
  }
  if (!messages.some((m) => pattern.test(m))) {
    throw new Error(`Erro de banco não corresponde a ${pattern}: ${messages.join(" | ")}`);
  }
}

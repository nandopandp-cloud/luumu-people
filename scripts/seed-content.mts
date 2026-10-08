import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { activeUserIds, seedContent } from "../src/server/db/seed/content";
import { ownerDatabase, schema as s } from "./_db";

/**
 * Carrega o CONTEÚDO DE EXEMPLO (comunicados, trilhas, cursos, biblioteca,
 * conquistas e uma jornada demonstrativa) em uma empresa existente.
 *
 *   pnpm content:seed --tenant jovens-genios
 */
const { values } = parseArgs({ options: { tenant: { type: "string" } } });
if (!values.tenant) {
  console.error("Uso: --tenant <slug>");
  process.exit(1);
}
const { db, pool } = ownerDatabase();
try {
  const [org] = await db.select({ id: s.organizations.id }).from(s.organizations).where(eq(s.organizations.slug, values.tenant));
  if (!org) throw new Error(`Empresa "${values.tenant}" não encontrada.`);
  const done = await db.transaction(async (tx) => {
    const t = tx as unknown as typeof db;
    return seedContent(t, org.id, await activeUserIds(t, org.id));
  });
  console.log(done ? "✓ Conteúdo de exemplo carregado." : "Nada a fazer: a empresa já tem comunicados.");
} finally {
  await pool.end();
}

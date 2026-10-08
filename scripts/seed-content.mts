import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { activeUserIds, seedContent, seedLessons } from "../src/server/db/seed/content";
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
  const [done, lessons] = await db.transaction(async (tx) => {
    const t = tx as unknown as typeof db;
    const content = await seedContent(t, org.id, await activeUserIds(t, org.id));
    // Completa cursos antigos sem aulas (idempotente).
    return [content, await seedLessons(t, org.id)] as const;
  });
  console.log(done ? "✓ Conteúdo de exemplo carregado." : "Comunicados e trilhas já existiam.");
  console.log(`✓ Aulas criadas para ${lessons} curso(s) sem aulas.`);
} finally {
  await pool.end();
}

import { seedDemo } from "../src/server/db/seed";
import { ownerDatabase } from "./_db";

/**
 * Dados DEMONSTRATIVOS (empresas fictícias). Use em bancos de desenvolvimento/preview.
 * Recusa rodar em produção.
 */
const password = process.env.SEED_PASSWORD;
if (!password || password.length < 12) {
  console.error("Defina SEED_PASSWORD (mín. 12 caracteres) para as contas demonstrativas.");
  process.exit(1);
}
if (process.env.VERCEL_ENV === "production") {
  console.error("Seed demonstrativo não pode rodar em produção.");
  process.exit(1);
}
const { db, pool } = ownerDatabase();
try {
  const result = await seedDemo(db, password);
  for (const [slug, org] of result) console.log(`✓ ${slug}: ${org.users.size} pessoas`);
  if (result.size === 0) console.log("Nada a fazer: organizações demonstrativas já existem.");
} finally {
  await pool.end();
}

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ownerDatabase } from "./_db";

/**
 * Backup lógico de TODAS as tabelas (public, app e o cofre survey_vault) num
 * JSON, numa leitura consistente (REPEATABLE READ, só leitura). Use antes de
 * qualquer limpeza em produção — e, de preferência, crie também um branch no Neon.
 *
 *   pnpm tsx scripts/backup-database.mts /caminho/fora/do/repo/backup.json
 *
 * O arquivo contém dados pessoais: guarde fora do repositório.
 */
const out = process.argv[2];
if (!out) {
  console.error("Informe o arquivo de saída (fora do repositório).");
  process.exit(1);
}
if (path.resolve(out).startsWith(path.resolve(import.meta.dirname, ".."))) {
  console.error("Por segurança, o backup não pode ficar dentro do repositório.");
  process.exit(1);
}

const { pool } = ownerDatabase();
const client = await pool.connect();
try {
  await client.query("begin isolation level repeatable read read only");
  const tables = (
    await client.query<{ s: string; t: string }>(
      "select table_schema as s, table_name as t from information_schema.tables where table_type = 'BASE TABLE' and table_schema in ('public', 'app', 'survey_vault') order by 1, 2",
    )
  ).rows;
  const dump: Record<string, unknown[]> = {};
  for (const { s, t } of tables) dump[`${s}.${t}`] = (await client.query(`select * from "${s}"."${t}"`)).rows;
  await client.query("commit");
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ takenAt: new Date().toISOString(), tables: dump }), { mode: 0o600 });
  const total = Object.values(dump).reduce((sum, rows) => sum + rows.length, 0);
  console.log(`✓ Backup: ${tables.length} tabelas, ${total} linhas → ${out}`);
} finally {
  client.release();
  await pool.end();
}

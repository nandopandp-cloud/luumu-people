import { parseArgs } from "node:util";
import { ownerDatabase } from "./_db";

/**
 * Libera espaço no Vercel Blob: remove o conteúdo de arquivos que ninguém mais usa.
 * Por padrão é SIMULAÇÃO (só conta e mostra); com --apply apaga de verdade.
 *
 *   pnpm tsx scripts/purge-orphan-files.mts                      # simulação
 *   BLOB_READ_WRITE_TOKEN=… pnpm tsx scripts/purge-orphan-files.mts --apply
 *
 * Um arquivo é descartável quando:
 *  - já foi apagado logicamente (`deleted_at`: anexo de conversa de mensagem apagada); ou
 *  - NENHUMA tabela o referencia (descoberto pelas chaves estrangeiras para `files`, então
 *    tabelas novas entram sozinhas), não é o avatar/capa atual de ninguém e foi enviado há
 *    mais de --grace-days (padrão 2): foto de perfil trocada, banner/capa substituídos,
 *    anexo escolhido e nunca enviado, envio abandonado.
 *
 * Os registros em `files` ficam (trilha); os órfãos recebem `deleted_at`, o que também
 * faz a API deixar de entregá-los. Rodar de novo é seguro (apagar o que já foi apagado não falha).
 */
const { values } = parseArgs({
  options: {
    apply: { type: "boolean", default: false },
    "grace-days": { type: "string", default: "2" },
  },
});
const graceDays = Number(values["grace-days"]);
if (!Number.isInteger(graceDays) || graceDays < 1) {
  console.error("--grace-days precisa ser um inteiro ≥ 1 (dá tempo de uploads em andamento terminarem).");
  process.exit(1);
}
if (values.apply && !process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("Defina BLOB_READ_WRITE_TOKEN (o mesmo token do Blob store de produção) para apagar de verdade.");
  process.exit(1);
}

const { pool } = ownerDatabase();
const client = await pool.connect();
try {
  // Todas as colunas que apontam para public.files (exceto o tenant_id das chaves compostas).
  const refs = (
    await client.query<{ tbl: string; col: string }>(`
      select c.conrelid::regclass::text as tbl, a.attname as col
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
      where c.contype = 'f' and c.confrelid = 'public.files'::regclass
        and c.conrelid <> 'public.files'::regclass and a.attname <> 'tenant_id'`)
  ).rows;
  console.log(`Referências a arquivos encontradas: ${refs.map((r) => `${r.tbl}.${r.col}`).join(", ") || "(nenhuma)"}`);

  const referenced = refs.map((r) => `exists (select 1 from ${r.tbl} r where r."${r.col}" = f.id)`);
  // Avatar e capa do perfil guardam a URL interna, não uma chave estrangeira.
  referenced.push(`exists (select 1 from users u where u.image like '%/api/v1/files/' || f.id::text or u.profile_cover like '%/api/v1/files/' || f.id::text)`);

  const candidates = (
    await client.query<{ id: string; storage_key: string; purpose: string; size_bytes: number; deleted: boolean }>(
      `select f.id, f.storage_key, f.purpose, f.size_bytes, f.deleted_at is not null as deleted
       from files f
       where f.deleted_at is not null
          or (f.created_at < now() - make_interval(days => $1) and not (${referenced.join(" or ")}))
       order by f.created_at`,
      [graceDays],
    )
  ).rows;

  const byPurpose = new Map<string, { n: number; bytes: number }>();
  for (const c of candidates) {
    const entry = byPurpose.get(c.purpose) ?? { n: 0, bytes: 0 };
    entry.n += 1;
    entry.bytes += c.size_bytes;
    byPurpose.set(c.purpose, entry);
  }
  const mb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);
  for (const [purpose, e] of byPurpose) console.log(`  ${purpose}: ${e.n} arquivo(s), ${mb(e.bytes)} MB`);
  const total = candidates.reduce((sum, c) => sum + c.size_bytes, 0);
  console.log(`Descartáveis: ${candidates.length} arquivo(s), ${mb(total)} MB.`);

  if (!values.apply) {
    console.log("Simulação: nada foi apagado. Use --apply para liberar o espaço.");
  } else if (candidates.length > 0) {
    const { del } = await import("@vercel/blob");
    for (let i = 0; i < candidates.length; i += 100) {
      const batch = candidates.slice(i, i + 100);
      await del(batch.map((c) => c.storage_key));
      const fresh = batch.filter((c) => !c.deleted).map((c) => c.id);
      if (fresh.length) await client.query("update files set deleted_at = now() where id = any ($1::uuid[]) and deleted_at is null", [fresh]);
      console.log(`  apagados ${Math.min(i + 100, candidates.length)}/${candidates.length}`);
    }
    console.log(`✓ ${mb(total)} MB liberados no Blob.`);
  }
} finally {
  client.release();
  await pool.end();
}

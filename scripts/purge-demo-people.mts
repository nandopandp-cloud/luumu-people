import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { ownerDatabase } from "./_db";

/**
 * Remove as pessoas de DEMONSTRAÇÃO de uma empresa e o conteúdo ligado a elas,
 * mantendo só as contas indicadas em --keep (ex.: o admin). Uma transação só;
 * por padrão é SIMULAÇÃO (desfaz tudo no fim e mostra o que aconteceria).
 *
 *   pnpm tsx scripts/purge-demo-people.mts --tenant jovens-genios --keep admin@empresa.com            # simulação
 *   pnpm tsx scripts/purge-demo-people.mts --tenant jovens-genios --keep admin@empresa.com --apply    # de verdade
 *
 * Apaga: pessoas (menos --keep) e os dados pessoais delas; TODAS as pesquisas
 * (pelo cofre: survey_vault.purge) e TODOS os comunicados; eventos, banners e
 * links rápidos criados por elas; áreas, cargos e níveis que ficarem sem uso.
 * Mantém: catálogo (cursos, trilhas, biblioteca, competências), configurações e
 * arquivos (a autoria passa para a primeira conta de --keep).
 *
 * A trilha de auditoria é só-inclusão: a trava é desligada APENAS dentro da
 * transação para remover os registros feitos pelas pessoas de demonstração, e
 * um registro novo ("dados de demonstração removidos") documenta a limpeza.
 * Faça antes: scripts/backup-database.mts (e um branch no Neon).
 */
const { values } = parseArgs({
  options: {
    tenant: { type: "string" },
    keep: { type: "string", multiple: true },
    "keep-from": { type: "string" },
    /** Também apaga PDIs e avaliações de competência de quem fica (dados de teste). */
    "reset-development": { type: "boolean", default: false },
    apply: { type: "boolean", default: false },
  },
});
// --keep-from: JSON do import-structure (mantém todas as pessoas dele).
const fromFile = values["keep-from"] ? (JSON.parse(readFileSync(values["keep-from"], "utf8")) as { people: { email: string }[] }).people.map((p) => p.email) : [];
const keep = [...new Set([...(values.keep ?? []), ...fromFile].map((e) => e.trim().toLowerCase()))];
if (!values.tenant || !values.keep?.length) {
  console.error("Uso: --tenant <slug> --keep <email do admin> [--keep …] [--keep-from estrutura.json] [--apply]");
  process.exit(1);
}

const { pool } = ownerDatabase();
const client = await pool.connect();
const report: [string, number][] = [];
async function step(label: string, sql: string, params: unknown[] = []) {
  const result = await client.query(sql, params);
  report.push([label, result.rowCount ?? 0]);
}

try {
  await client.query("begin");
  const org = (await client.query<{ id: string }>("select id from organizations where slug = $1", [values.tenant])).rows[0];
  if (!org) throw new Error(`Empresa "${values.tenant}" não encontrada.`);
  const tenant = org.id;
  const keepers = (await client.query<{ id: string; email: string }>("select id, email from users where tenant_id = $1 and email = any($2)", [tenant, keep])).rows;
  const explicit = (values.keep ?? []).map((e) => e.trim().toLowerCase());
  const missing = explicit.filter((e) => !keepers.some((k) => k.email === e));
  if (missing.length) throw new Error(`Conta(s) a manter não encontrada(s): ${missing.join(", ")}`);
  // Autoria do que fica vai para a primeira conta de --keep (o admin).
  const admin = keepers.find((k) => k.email === values.keep![0]!.trim().toLowerCase())!.id;

  await client.query("create temp table doomed on commit drop as select id from users where tenant_id = $1 and not (email = any($2))", [tenant, keep]);
  const doomedCount = (await client.query<{ n: number }>("select count(*)::int as n from doomed")).rows[0]!.n;
  report.push(["pessoas a remover", doomedCount]);
  await client.query("select set_config('app.tenant_id', $1, true)", [tenant]);

  // Pesquisas: lançadas pelo cofre (apaga respostas, convites e a pesquisa); rascunhos direto.
  const launched = (await client.query<{ id: string }>("select id from surveys where tenant_id = $1 and status <> 'draft'", [tenant])).rows;
  for (const s of launched) await client.query("select survey_vault.purge($1::uuid)", [s.id]);
  report.push(["pesquisas lançadas (pelo cofre)", launched.length]);
  await step("pesquisas em rascunho", "delete from surveys where tenant_id = $1", [tenant]);

  await step("comunicados (com comentários, reações e anexos)", "delete from announcements where tenant_id = $1", [tenant]);
  await step("eventos de demonstração", "delete from events where tenant_id = $1 and created_by in (select id from doomed)", [tenant]);
  await step("banners de demonstração", "delete from home_banners where tenant_id = $1 and created_by in (select id from doomed)", [tenant]);
  await step("links rápidos de demonstração", "delete from quick_links where tenant_id = $1 and created_by in (select id from doomed)", [tenant]);

  await step("notificações", "delete from notifications where recipient_id in (select id from doomed) or actor_id in (select id from doomed)");
  await step("leituras e preferências de notificação", "with a as (delete from notification_reads where user_id in (select id from doomed) returning 1), b as (delete from notification_preferences where user_id in (select id from doomed) returning 1) select 1 from a union all select 1 from b");
  await step("conversas com pessoas de demonstração", "delete from conversations where id in (select conversation_id from conversation_members where user_id in (select id from doomed)) or created_by in (select id from doomed)");
  await step("curtidas e participações restantes no chat", "with a as (delete from chat_message_likes where user_id in (select id from doomed) returning 1), b as (delete from conversation_members where user_id in (select id from doomed) returning 1) select 1 from a union all select 1 from b");
  await step("conexões, seguidores, interesses e presença", `with a as (delete from friendships where requester_id in (select id from doomed) or addressee_id in (select id from doomed) returning 1),
    b as (delete from user_follows where follower_id in (select id from doomed) or followee_id in (select id from doomed) returning 1),
    c as (delete from connection_suggestion_dismissals where user_id in (select id from doomed) or dismissed_user_id in (select id from doomed) returning 1),
    d as (delete from user_interests where user_id in (select id from doomed) returning 1),
    e as (delete from user_presence where user_id in (select id from doomed) returning 1)
    select 1 from a union all select 1 from b union all select 1 from c union all select 1 from d union all select 1 from e`);

  await step("PDIs (metas e ações)", "delete from pdis where user_id in (select id from doomed)");
  await step("PDIs mantidos: mentoria/autoria ajustadas", `with a as (update pdis set mentor_user_id = null where mentor_user_id in (select id from doomed) returning 1),
    b as (update pdis set created_by = $1 where created_by in (select id from doomed) returning 1),
    c as (update pdi_actions set created_by = $1 where created_by in (select id from doomed) returning 1)
    select 1 from a union all select 1 from b union all select 1 from c`, [admin]);
  await step("avaliações de competência", "delete from competency_assessments where user_id in (select id from doomed) or assessed_by in (select id from doomed)");
  if (values["reset-development"]) {
    await step("PDIs de teste de quem fica", "delete from pdis where tenant_id = $1", [tenant]);
    await step("avaliações de teste de quem fica", "delete from competency_assessments where tenant_id = $1", [tenant]);
  }

  await step("relações de gestão", "delete from manager_relationships where user_id in (select id from doomed) or manager_id in (select id from doomed)");
  await step("lotações", "delete from employment_assignments where user_id in (select id from doomed)");
  await step("papéis", "delete from user_roles where user_id in (select id from doomed)");
  await step("autoria de registros mantidos → admin", `with a as (update manager_relationships set created_by = $1 where created_by in (select id from doomed) returning 1),
    b as (update employment_assignments set created_by = $1 where created_by in (select id from doomed) returning 1),
    c as (update user_roles set granted_by = $1 where granted_by in (select id from doomed) returning 1),
    d as (update user_roles set revoked_by = $1 where revoked_by in (select id from doomed) returning 1),
    e as (update files set owner_user_id = $1 where owner_user_id in (select id from doomed) returning 1)
    select 1 from a union all select 1 from b union all select 1 from c union all select 1 from d union all select 1 from e`, [admin]);
  await step("perfis de RH", "delete from employee_profiles where user_id in (select id from doomed)");

  await client.query("alter table audit_logs disable trigger audit_logs_append_only");
  await step("registros de auditoria feitos por pessoas de demonstração", "delete from audit_logs where actor_user_id in (select id from doomed)");
  await client.query("alter table audit_logs enable trigger audit_logs_append_only");

  await step("contas (sessões, cursos, humor etc. em cascata)", "delete from users where id in (select id from doomed)");

  // Estrutura sem uso: cargos e níveis, depois áreas das folhas para a raiz.
  await step("cargos sem uso", "delete from positions where tenant_id = $1 and id not in (select position_id from employment_assignments)", [tenant]);
  await step("níveis sem uso", "delete from job_levels where tenant_id = $1 and id not in (select job_level_id from employment_assignments where job_level_id is not null)", [tenant]);
  let removedUnits = 0;
  for (;;) {
    const r = await client.query(
      `delete from org_units ou where ou.tenant_id = $1
         and not exists (select 1 from org_units c where c.parent_id = ou.id)
         and not exists (select 1 from employment_assignments ea where ea.org_unit_id = ou.id)
         and not exists (select 1 from user_roles ur where ur.scope_org_unit_id = ou.id)`,
      [tenant],
    );
    if (!r.rowCount) break;
    removedUnits += r.rowCount;
  }
  report.push(["áreas sem uso", removedUnits]);

  await client.query(
    "insert into audit_logs (tenant_id, actor_type, action, resource_type, resource_id, metadata) values ($1::uuid, 'system', 'tenant.demo_data_removed', 'organization', $1::text, $2)",
    [tenant, JSON.stringify({ people: doomedCount, surveys: launched.length, kept: keep.length })],
  );

  const left = (await client.query("select (select count(*) from users where tenant_id = $1)::int as pessoas, (select count(*) from org_units where tenant_id = $1)::int as areas, (select count(*) from positions where tenant_id = $1)::int as cargos", [tenant])).rows[0];
  for (const [label, n] of report) console.log(`  ${String(n).padStart(5)}  ${label}`);
  console.log(`  Ficam: ${left.pessoas} pessoa(s), ${left.areas} área(s), ${left.cargos} cargo(s).`);

  if (values.apply) {
    await client.query("commit");
    console.log("✓ Limpeza APLICADA.");
  } else {
    await client.query("rollback");
    console.log("Simulação: nada foi alterado. Rode com --apply para aplicar.");
  }
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  client.release();
  await pool.end();
}

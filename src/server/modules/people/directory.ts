import "server-only";
import { and, asc, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import { recordAudit } from "@/server/audit/audit";
import type { AuthenticatedActor } from "@/server/auth/session";
import { hasPermissionAnywhere, hasTenantWide } from "@/server/authz/policy";
import { accessibleUsersCondition, orgSubtreeSql } from "@/server/authz/resolver";
import * as s from "@/server/db/schema";
import { withTenant, type Tx } from "@/server/db/tenant";
import { forbidden } from "@/server/http/errors";
import { csvCell } from "@/server/modules/reports/development";
import type { DirectoryExport, DirectoryQuery } from "./schemas";

/**
 * Diretório da gestão (página Colaboradores). Mesmas regras do diretório:
 * só dados PROFISSIONAIS e sempre no escopo de people.directory.read.
 *  - "Último acesso" é dado de uso: só para quem administra pessoas na empresa
 *    toda (people.manage).
 *  - Filtrar pela situação do vínculo (afastado/desligado) é dado de RH:
 *    exige people.profile.read_full na empresa toda.
 */

type Rows<T> = { rows: T[] };
const rows = <T>(r: unknown) => (r as Rows<T>).rows;

type Meta = { ip: string | null; userAgent: string | null; requestId: string };

export type DirectoryRow = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  status: "invited" | "active" | "inactive";
  position: string | null;
  orgUnitId: string | null;
  orgUnit: string | null;
  businessUnit: string | null;
  level: string | null;
  hireDate: string | null;
  managerId: string | null;
  managerName: string | null;
  managerImage: string | null;
  lastAccessAt: Date | null;
};

/** Quem tem o papel Gestor ativo. */
export const MANAGER_IDS = sql`select ur.user_id from user_roles ur join roles r on r.id = ur.role_id where r.key = 'manager' and ur.revoked_at is null`;

export const canSeeLastAccess = (actor: AuthenticatedActor) => hasTenantWide(actor, "people.manage");

const FROM = sql`
  from users u
  left join employee_profiles ep on ep.user_id = u.id
  left join employment_assignments ea on ea.user_id = u.id and ea.valid_to is null
  left join positions p on p.id = ea.position_id
  left join job_levels jl on jl.id = ea.job_level_id
  left join org_units ou on ou.id = ea.org_unit_id
  left join business_units bu on bu.id = ea.business_unit_id
  left join manager_relationships mr on mr.user_id = u.id and mr.valid_to is null
  left join users m on m.id = mr.manager_id
  left join user_presence up on up.user_id = u.id
  left join lateral (select max(ud.last_seen_at) as at from usage_days ud where ud.user_id = u.id) ud on true`;

/** Último sinal de uso: presença (mais recente) ou o histórico diário de uso. */
const LAST_ACCESS = sql`greatest(up.last_seen_at, ud.at)`;

function columns(lastAccess: boolean) {
  return sql`u.id, u.name, u.email, u.image, u.status, p.name as position, ou.id as "orgUnitId", ou.name as "orgUnit",
    bu.name as "businessUnit", jl.name as level, ep.hire_date::text as "hireDate",
    m.id as "managerId", m.name as "managerName", m.image as "managerImage",
    ${lastAccess ? LAST_ACCESS : sql`null::timestamptz`} as "lastAccessAt"`;
}

/** Filtros comuns (sem a aba de acesso, que as contagens ignoram). */
function filters(actor: AuthenticatedActor, query: Omit<DirectoryQuery, "page" | "perPage" | "sort" | "dir" | "status">, permission: "people.directory.read" | "reports.export" = "people.directory.read"): SQL[] {
  const where: SQL[] = [accessibleUsersCondition(actor, "people.directory.read", sql`u.id`)];
  if (permission !== "people.directory.read") where.push(accessibleUsersCondition(actor, permission, sql`u.id`));
  if (query.search) {
    const term = `%${query.search.replace(/[%_\\]/g, "\\$&")}%`;
    where.push(sql`(u.name ilike ${term} or u.email ilike ${term} or p.name ilike ${term} or ou.name ilike ${term})`);
  }
  if (query.orgUnitId) where.push(sql`ea.org_unit_id in ${orgSubtreeSql(query.orgUnitId)}`);
  if (query.positionId) where.push(sql`ea.position_id = ${query.positionId}`);
  if (query.businessUnitId) where.push(sql`ea.business_unit_id = ${query.businessUnitId}`);
  if (query.jobLevelId) where.push(sql`ea.job_level_id = ${query.jobLevelId}`);
  if (query.managerId) where.push(sql`mr.manager_id = ${query.managerId}`);
  if (query.employmentStatus) {
    if (!hasTenantWide(actor, "people.profile.read_full")) throw forbidden("Filtrar pela situação do vínculo exige acesso aos dados de RH.");
    where.push(sql`ep.employment_status = ${query.employmentStatus}`);
  }
  return where;
}

const SORT_COLUMNS: Record<DirectoryQuery["sort"], SQL> = {
  name: sql`u.name`,
  position: sql`p.name`,
  orgUnit: sql`ou.name`,
  manager: sql`m.name`,
  status: sql`u.status`,
  lastAccess: LAST_ACCESS,
};

function orderBy(actor: AuthenticatedActor, sort: DirectoryQuery["sort"], dir: DirectoryQuery["dir"]) {
  const key = sort === "lastAccess" && !canSeeLastAccess(actor) ? "name" : sort;
  const direction = dir === "desc" ? sql.raw("desc") : sql.raw("asc");
  return sql`order by ${SORT_COLUMNS[key]} ${direction} nulls last, u.name asc, u.id asc`;
}

export async function listDirectory(actor: AuthenticatedActor, query: DirectoryQuery) {
  const lastAccess = canSeeLastAccess(actor);
  return withTenant(actor, async (tx) => {
    const base = filters(actor, query);
    const where = sql.join(query.status ? [...base, sql`u.status = ${query.status}`] : base, sql` and `);
    const offset = (query.page - 1) * query.perPage;
    const [items, totals] = await Promise.all([
      tx.execute(sql`select ${columns(lastAccess)} ${FROM} where ${where} ${orderBy(actor, query.sort, query.dir)} limit ${query.perPage} offset ${offset}`),
      tx.execute(sql`select u.status, count(*)::int as count ${FROM} where ${sql.join(base, sql` and `)} group by u.status`),
    ]);
    const byStatus = Object.fromEntries(rows<{ status: string; count: number }>(totals).map((r) => [r.status, r.count]));
    const counts = { all: 0, active: byStatus.active ?? 0, inactive: byStatus.inactive ?? 0, invited: byStatus.invited ?? 0 };
    counts.all = counts.active + counts.inactive + counts.invited;
    const total = query.status ? counts[query.status] : counts.all;
    return { items: rows<DirectoryRow>(items).map((r) => ({ ...r, lastAccessAt: r.lastAccessAt ? new Date(r.lastAccessAt) : null })), total, counts, page: query.page, perPage: query.perPage, lastAccess };
  });
}

/** Opções dos filtros: estrutura (não sensível) e gestores vigentes no escopo. */
export async function getDirectoryFilters(actor: AuthenticatedActor) {
  return withTenant(actor, async (tx: Tx) => {
    const [orgUnits, positions, businessUnits, jobLevels, managers] = await Promise.all([
      tx.select({ id: s.orgUnits.id, name: s.orgUnits.name, type: s.orgUnits.type }).from(s.orgUnits).where(isNull(s.orgUnits.archivedAt)).orderBy(asc(s.orgUnits.name)),
      tx.select({ id: s.positions.id, name: s.positions.name }).from(s.positions).orderBy(asc(s.positions.name)),
      tx.select({ id: s.businessUnits.id, name: s.businessUnits.name }).from(s.businessUnits).where(isNull(s.businessUnits.archivedAt)).orderBy(asc(s.businessUnits.name)),
      tx.select({ id: s.jobLevels.id, name: s.jobLevels.name }).from(s.jobLevels).orderBy(asc(s.jobLevels.name)),
      tx.execute(sql`
        select distinct m.id, m.name from manager_relationships mr join users m on m.id = mr.manager_id
        where mr.valid_to is null and ${accessibleUsersCondition(actor, "people.directory.read", sql`mr.user_id`)}
        order by m.name`),
    ]);
    return { orgUnits, positions, businessUnits, jobLevels, managers: rows<{ id: string; name: string }>(managers), canFilterEmployment: hasTenantWide(actor, "people.profile.read_full") };
  });
}

const STATUS_LABEL = { active: "Ativo", invited: "Convite pendente", inactive: "Inativo" } as const;

/**
 * Exporta o diretório filtrado (ou a seleção) em CSV. Só pessoas no escopo de
 * people.directory.read E reports.export; auditado como `data.exported`.
 */
export async function exportDirectoryCsv(actor: AuthenticatedActor, query: DirectoryExport, meta: Meta): Promise<{ csv: string; rows: number }> {
  if (!hasPermissionAnywhere(actor, "reports.export")) throw forbidden();
  const lastAccess = canSeeLastAccess(actor);
  return withTenant(actor, async (tx) => {
    const where = filters(actor, query, "reports.export");
    if (query.status) where.push(sql`u.status = ${query.status}`);
    if (query.ids?.length) where.push(sql`u.id in (${sql.join(query.ids.map((id) => sql`${id}::uuid`), sql`, `)})`);
    const people = rows<DirectoryRow>(await tx.execute(sql`select ${columns(lastAccess)} ${FROM} where ${sql.join(where, sql` and `)} ${orderBy(actor, query.sort, query.dir)}`));
    const header = ["Nome", "E-mail", "Cargo", "Nível", "Área", "Unidade", "Gestor(a)", "Situação", "Admissão", ...(lastAccess ? ["Último acesso"] : [])];
    const lines = [header.map(csvCell).join(";")];
    const when = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
    for (const p of people) {
      const hire = p.hireDate ? p.hireDate.split("-").reverse().join("/") : null;
      const access = lastAccess ? [p.lastAccessAt ? when.format(new Date(p.lastAccessAt)) : null] : [];
      lines.push([p.name, p.email, p.position, p.level, p.orgUnit, p.businessUnit, p.managerName, STATUS_LABEL[p.status], hire, ...access].map(csvCell).join(";"));
    }
    await recordAudit(tx, {
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      action: "data.exported",
      resourceType: "report",
      resourceId: null,
      metadata: { report: "people", rows: people.length, selection: Boolean(query.ids?.length) },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });
    return { csv: `﻿${lines.join("\r\n")}\r\n`, rows: people.length };
  });
}

/** Gestores (papel Gestor ativo) que podem receber alguém novo (formulário de cadastro). */
export async function listManagerCandidates(actor: AuthenticatedActor) {
  if (!hasTenantWide(actor, "people.manage")) throw forbidden();
  return withTenant(actor, (tx) =>
    tx
      .select({ id: s.users.id, name: s.users.name, image: s.users.image })
      .from(s.users)
      .where(and(sql`${s.users.status} = 'active'`, isNotNull(s.users.name), sql`${s.users.id} in (${MANAGER_IDS})`))
      .orderBy(asc(s.users.name)),
  );
}

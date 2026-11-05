import "server-only";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { JOB_LEVEL_NAMES, MANAGERIAL_POSITIONS } from "@/lib/job-catalog";
import { recordAudit } from "@/server/audit/audit";
import { sendInvite } from "@/server/auth/invite";
import { revokeUserSessions, type AuthenticatedActor } from "@/server/auth/session";
import type { Permission } from "@/server/authz/permissions";
import { hasTenantWide } from "@/server/authz/policy";
import { teamTreeSql } from "@/server/authz/resolver";
import * as s from "@/server/db/schema";
import { withTenant, type Tx } from "@/server/db/tenant";
import { badRequest, conflict, forbidden, notFound } from "@/server/http/errors";
import { logger } from "@/server/observability/logger";
import { MANAGER_IDS } from "./directory";
import type { PersonCreate, PersonUpdate } from "./schemas";

/**
 * Administração de pessoas (people.manage, sempre na empresa toda):
 * cadastro com convite, edição dos dados, desativação/reativação e reenvio do convite.
 * A pessoa nasce "convidada" e só vira "ativa" ao criar a senha (ver auth.ts).
 */

type Meta = { ip: string | null; userAgent: string | null; requestId: string };

function assertCanManage(actor: AuthenticatedActor) {
  if (!hasTenantWide(actor, "people.manage")) throw forbidden();
}

/** Violação de unicidade do Postgres (o Drizzle guarda o erro original em `cause`). */
function isUniqueViolation(error: unknown) {
  for (let e: unknown = error; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: unknown }).code === "23505") return true;
  }
  return false;
}

async function organizationName(tx: Tx) {
  const [org] = await tx.select({ name: s.organizations.name }).from(s.organizations);
  return org?.name ?? "sua empresa";
}

type PeopleAction = "people.created" | "people.invited" | "people.updated" | "people.transferred" | "people.manager_changed" | "people.deactivated" | "people.reactivated";

async function audit(tx: Tx, actor: AuthenticatedActor, action: PeopleAction, userId: string, meta: Meta, metadata?: Record<string, unknown>) {
  await recordAudit(tx, { tenantId: actor.tenantId, actorUserId: actor.userId, action, resourceType: "user", resourceId: userId, metadata, ipAddress: meta.ip, userAgent: meta.userAgent, requestId: meta.requestId });
}

/** Envia o convite fora da transação do cadastro: se o e-mail falhar, a pessoa continua cadastrada. */
async function invite(actor: AuthenticatedActor, user: { id: string; name: string; email: string }, meta: Meta): Promise<boolean> {
  try {
    const { org, inviter } = await withTenant(actor, async (tx) => {
      const [me] = await tx.select({ name: s.users.name }).from(s.users).where(eq(s.users.id, actor.userId));
      return { org: await organizationName(tx), inviter: me?.name ?? "A equipe de Gente & Gestão" };
    });
    await sendInvite(user, org, inviter);
    await withTenant(actor, (tx) => audit(tx, actor, "people.invited", user.id, meta));
    return true;
  } catch (error) {
    logger().error({ err: error }, "falha ao enviar convite de acesso");
    return false;
  }
}

/** Cargo da lista fixa: usa o da empresa com esse nome ou cria. */
async function findOrCreatePosition(tx: Tx, tenantId: string, name: PersonCreate["position"]) {
  await tx.insert(s.positions).values({ tenantId, name, isManagerial: MANAGERIAL_POSITIONS.includes(name) }).onConflictDoNothing();
  const [row] = await tx.select({ id: s.positions.id }).from(s.positions).where(eq(s.positions.name, name));
  return row!.id;
}

/** Nível da lista fixa: usa o da empresa com esse nome ou cria (ordem = posição na lista). */
async function findOrCreateJobLevel(tx: Tx, tenantId: string, name: PersonCreate["jobLevel"]) {
  await tx.insert(s.jobLevels).values({ tenantId, name, rank: JOB_LEVEL_NAMES.indexOf(name) + 1 }).onConflictDoNothing();
  const [row] = await tx.select({ id: s.jobLevels.id }).from(s.jobLevels).where(eq(s.jobLevels.name, name));
  return row!.id;
}

export async function createPerson(actor: AuthenticatedActor, input: PersonCreate, meta: Meta) {
  assertCanManage(actor);
  let created: { id: string; name: string; email: string };
  try {
    created = await withTenant(actor, async (tx) => {
      // Estrutura e gestor(a) precisam existir na empresa (a RLS já limita ao tenant).
      const [unit] = await tx.select({ id: s.orgUnits.id }).from(s.orgUnits).where(eq(s.orgUnits.id, input.orgUnitId));
      if (!unit) throw badRequest("Área não encontrada.");
      const positionId = await findOrCreatePosition(tx, actor.tenantId, input.position);
      const jobLevelId = await findOrCreateJobLevel(tx, actor.tenantId, input.jobLevel);
      const [boss] = await tx.select({ id: s.users.id }).from(s.users).where(and(eq(s.users.id, input.managerId), eq(s.users.status, "active"), sql`${s.users.id} in (${MANAGER_IDS})`));
      if (!boss) throw badRequest("Escolha um(a) gestor(a) ativo(a) com o papel Gestor.");
      const [employeeRole] = await tx.select({ id: s.roles.id }).from(s.roles).where(and(eq(s.roles.key, "employee"), eq(s.roles.isSystem, true)));
      if (!employeeRole) throw new Error("Papel de sistema 'employee' ausente no tenant.");

      const [user] = await tx
        .insert(s.users)
        .values({ tenantId: actor.tenantId, name: input.name, email: input.email, status: "invited" })
        .returning({ id: s.users.id, name: s.users.name, email: s.users.email });
      await tx.insert(s.employeeProfiles).values({ userId: user!.id, tenantId: actor.tenantId, hireDate: input.hireDate, contractType: input.contractType });
      await tx.insert(s.employmentAssignments).values({
        tenantId: actor.tenantId,
        userId: user!.id,
        orgUnitId: input.orgUnitId,
        positionId,
        jobLevelId,
        validFrom: input.hireDate,
        reason: "hire",
        createdBy: actor.userId,
      });
      {
        await tx.insert(s.managerRelationships).values({ tenantId: actor.tenantId, userId: user!.id, managerId: input.managerId, validFrom: input.hireDate, createdBy: actor.userId });
      }
      await tx.insert(s.userRoles).values({ tenantId: actor.tenantId, userId: user!.id, roleId: employeeRole.id, scopeType: "SELF", grantedBy: actor.userId });
      await audit(tx, actor, "people.created", user!.id, meta, { fields: ["name", "email", "hireDate", "orgUnit", "position", "jobLevel", "manager"] });
      return user!;
    });
  } catch (error) {
    // E-mail é único na plataforma inteira (login): a mensagem não diz em qual empresa.
    if (isUniqueViolation(error)) throw conflict("Este e-mail já está em uso na plataforma.");
    throw error;
  }
  const invited = input.sendInvite ? await invite(actor, created, meta) : false;
  return { id: created.id, invited };
}

export async function resendInvite(actor: AuthenticatedActor, userId: string, meta: Meta) {
  assertCanManage(actor);
  const user = await withTenant(actor, async (tx) => {
    const [row] = await tx.select({ id: s.users.id, name: s.users.name, email: s.users.email, status: s.users.status }).from(s.users).where(eq(s.users.id, userId));
    return row;
  });
  if (!user) throw notFound();
  if (user.status !== "invited") throw conflict("Só pessoas com convite pendente recebem um novo convite.");
  if (!(await invite(actor, user, meta))) throw new Error("Não foi possível enviar o convite.");
  return { invited: true };
}

/**
 * Desativa ou reativa o acesso. A desativação vale na hora (a sessão é
 * revalidada a cada requisição). Ao reativar, quem nunca chegou a acessar
 * volta a "convidado" — não ganha acesso sem criar a própria senha.
 */
export async function setPersonStatus(actor: AuthenticatedActor, userId: string, status: "active" | "inactive", meta: Meta) {
  assertCanManage(actor);
  if (userId === actor.userId) throw badRequest("Você não pode alterar o próprio acesso.");
  return withTenant(actor, async (tx) => {
    const [user] = await tx.select({ id: s.users.id, status: s.users.status }).from(s.users).where(eq(s.users.id, userId));
    if (!user) throw notFound();
    if (status === "inactive") {
      if (user.status === "inactive") return { status: user.status };
      await tx.update(s.users).set({ status: "inactive" }).where(eq(s.users.id, userId));
      await audit(tx, actor, "people.deactivated", userId, meta, { from: user.status });
      return { status: "inactive" as const };
    }
    if (user.status !== "inactive") return { status: user.status };
    const [accessed] = await tx
      .select({ id: s.auditLogs.id })
      .from(s.auditLogs)
      .where(and(eq(s.auditLogs.actorUserId, userId), inArray(s.auditLogs.action, ["auth.login", "people.activated"])))
      .limit(1);
    const next = accessed ? "active" : "invited";
    await tx.update(s.users).set({ status: next }).where(and(eq(s.users.id, userId), sql`${s.users.status} = 'inactive'`));
    await audit(tx, actor, "people.reactivated", userId, meta, { to: next });
    return { status: next };
  });
}

/* ------------------------------------------------------------- edição */

/** Hoje (aaaa-mm-dd) no fuso de Brasília: início/fim de vigência das mudanças. */
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const later = (a: string, b: string) => (a > b ? a : b);

/** Opções do formulário de edição: estrutura, cargos e níveis da empresa (+ lista fixa), localidades e gestores. */
export async function getPersonEditOptions(actor: AuthenticatedActor) {
  assertCanManage(actor);
  return withTenant(actor, async (tx) => {
    const [orgUnits, positions, jobLevels, locations, managers] = await Promise.all([
      tx.select({ id: s.orgUnits.id, name: s.orgUnits.name, type: s.orgUnits.type }).from(s.orgUnits).where(isNull(s.orgUnits.archivedAt)).orderBy(asc(s.orgUnits.name)),
      tx.select({ id: s.positions.id, name: s.positions.name }).from(s.positions).where(isNull(s.positions.archivedAt)).orderBy(asc(s.positions.name)),
      tx.select({ id: s.jobLevels.id, name: s.jobLevels.name }).from(s.jobLevels).orderBy(asc(s.jobLevels.rank)),
      tx.select({ id: s.businessUnits.id, name: s.businessUnits.name, city: s.businessUnits.city, state: s.businessUnits.state }).from(s.businessUnits).where(isNull(s.businessUnits.archivedAt)).orderBy(asc(s.businessUnits.name)),
      tx
        .select({ id: s.users.id, name: s.users.name, image: s.users.image })
        .from(s.users)
        .where(and(eq(s.users.status, "active"), sql`${s.users.id} in (${MANAGER_IDS})`))
        .orderBy(asc(s.users.name)),
    ]);
    return { orgUnits, positions, jobLevels, locations, managers };
  });
}

/** Valores atuais para o formulário de edição (ids da lotação vigente + dados de RH). */
export async function getPersonForEdit(actor: AuthenticatedActor, userId: string) {
  assertCanManage(actor);
  return withTenant(actor, async (tx) => {
    const current = await currentRecord(tx, userId);
    if (!current) throw notFound();
    return current;
  });
}

async function currentRecord(tx: Tx, userId: string) {
  const [row] = await tx
    .select({
      id: s.users.id,
      name: s.users.name,
      email: s.users.email,
      preferredName: s.employeeProfiles.preferredName,
      hireDate: s.employeeProfiles.hireDate,
      employeeCode: s.employeeProfiles.employeeCode,
      contractType: s.employeeProfiles.contractType,
      employmentStatus: s.employeeProfiles.employmentStatus,
      phone: s.employeeProfiles.phone,
      hasProfile: sql<boolean>`${s.employeeProfiles.userId} is not null`,
      assignmentId: s.employmentAssignments.id,
      assignmentFrom: s.employmentAssignments.validFrom,
      orgUnitId: s.employmentAssignments.orgUnitId,
      positionId: s.employmentAssignments.positionId,
      jobLevelId: s.employmentAssignments.jobLevelId,
      businessUnitId: s.employmentAssignments.businessUnitId,
      managerRelationshipId: s.managerRelationships.id,
      managerFrom: s.managerRelationships.validFrom,
      managerId: s.managerRelationships.managerId,
    })
    .from(s.users)
    .leftJoin(s.employeeProfiles, eq(s.employeeProfiles.userId, s.users.id))
    .leftJoin(s.employmentAssignments, and(eq(s.employmentAssignments.userId, s.users.id), isNull(s.employmentAssignments.validTo)))
    .leftJoin(s.managerRelationships, and(eq(s.managerRelationships.userId, s.users.id), isNull(s.managerRelationships.validTo)))
    .where(eq(s.users.id, userId));
  return row ?? null;
}

/**
 * Trocar o e-mail de alguém equivale a poder recuperar a conta dessa pessoa
 * (o "esqueci a senha" vai para o novo endereço). Por isso exige o mesmo que
 * conceder os papéis dela: ter, na empresa toda, todas as permissões que ela tem.
 */
async function assertCanTakeOverAccount(tx: Tx, actor: AuthenticatedActor, userId: string) {
  if (userId === actor.userId) throw forbidden("O próprio e-mail só pode ser alterado por outra pessoa administradora.");
  const held = await tx
    .selectDistinct({ permission: s.rolePermissions.permissionKey })
    .from(s.userRoles)
    .innerJoin(s.rolePermissions, eq(s.rolePermissions.roleId, s.userRoles.roleId))
    .where(and(eq(s.userRoles.userId, userId), isNull(s.userRoles.revokedAt)));
  if (held.some((p) => !hasTenantWide(actor, p.permission as Permission))) {
    throw forbidden("Esta pessoa tem acessos que você não tem: só quem tem todos eles pode alterar o e-mail dela.");
  }
}

async function resolvePosition(tx: Tx, tenantId: string, input: PersonUpdate) {
  if (input.positionId) {
    const [row] = await tx.select({ id: s.positions.id }).from(s.positions).where(eq(s.positions.id, input.positionId));
    if (!row) throw badRequest("Cargo não encontrado.");
    return row.id;
  }
  return input.position ? findOrCreatePosition(tx, tenantId, input.position) : undefined;
}

async function resolveJobLevel(tx: Tx, tenantId: string, input: PersonUpdate) {
  if (input.jobLevelId) {
    const [row] = await tx.select({ id: s.jobLevels.id }).from(s.jobLevels).where(eq(s.jobLevels.id, input.jobLevelId));
    if (!row) throw badRequest("Nível não encontrado.");
    return row.id;
  }
  return input.jobLevel ? findOrCreateJobLevel(tx, tenantId, input.jobLevel) : undefined;
}

/** Localização = unidade (business_unit). Cidade/UF nova: usa a unidade com a mesma cidade e UF ou cria. */
async function resolveLocation(tx: Tx, tenantId: string, location: PersonUpdate["location"]): Promise<string | null | undefined> {
  if (location === undefined || location === null) return location;
  if ("businessUnitId" in location) {
    const [row] = await tx.select({ id: s.businessUnits.id }).from(s.businessUnits).where(eq(s.businessUnits.id, location.businessUnitId));
    if (!row) throw badRequest("Localização não encontrada.");
    return row.id;
  }
  const [same] = await tx
    .select({ id: s.businessUnits.id })
    .from(s.businessUnits)
    .where(and(isNull(s.businessUnits.archivedAt), sql`lower(${s.businessUnits.city}) = lower(${location.city})`, eq(s.businessUnits.state, location.state)))
    .limit(1);
  if (same) return same.id;
  const [created] = await tx.insert(s.businessUnits).values({ tenantId, name: location.city, city: location.city, state: location.state }).returning({ id: s.businessUnits.id });
  return created!.id;
}

/**
 * Edita os dados de um colaborador. Nome, e-mail e dados de RH são atualizados
 * no lugar; área, cargo, nível, localização e gestor(a) fecham o registro
 * vigente e abrem um novo (histórico). Auditoria só com os NOMES dos campos.
 */
export async function updatePerson(actor: AuthenticatedActor, userId: string, input: PersonUpdate, meta: Meta) {
  assertCanManage(actor);
  let emailChanged = false;
  let fields: string[] = [];
  try {
    await withTenant(actor, async (tx) => {
      const current = await currentRecord(tx, userId);
      if (!current) throw notFound();
      const changed = new Set<string>();
      const day = today();

      // Identidade (users).
      const userChanges: Partial<typeof s.users.$inferInsert> = {};
      if (input.name !== undefined && input.name !== current.name) userChanges.name = input.name;
      if (input.email !== undefined && input.email !== current.email) {
        await assertCanTakeOverAccount(tx, actor, userId);
        userChanges.email = input.email;
        emailChanged = true;
      }
      if (Object.keys(userChanges).length) {
        await tx.update(s.users).set(userChanges).where(eq(s.users.id, userId));
        Object.keys(userChanges).forEach((k) => changed.add(k));
      }

      // Dados de RH (employee_profiles).
      const profile: Partial<typeof s.employeeProfiles.$inferInsert> = {};
      for (const key of ["preferredName", "hireDate", "employeeCode", "contractType", "employmentStatus", "phone"] as const) {
        if (input[key] !== undefined && input[key] !== current[key]) Object.assign(profile, { [key]: input[key] });
      }
      if (Object.keys(profile).length) {
        if (current.hasProfile) await tx.update(s.employeeProfiles).set(profile).where(eq(s.employeeProfiles.userId, userId));
        else await tx.insert(s.employeeProfiles).values({ userId, tenantId: actor.tenantId, hireDate: input.hireDate ?? day, ...profile });
        Object.keys(profile).forEach((k) => changed.add(k));
      }

      // Lotação (employment_assignments, com vigência).
      if (input.orgUnitId) {
        const [unit] = await tx.select({ id: s.orgUnits.id }).from(s.orgUnits).where(eq(s.orgUnits.id, input.orgUnitId));
        if (!unit) throw badRequest("Área não encontrada.");
      }
      const next = {
        orgUnitId: input.orgUnitId ?? current.orgUnitId,
        positionId: (await resolvePosition(tx, actor.tenantId, input)) ?? current.positionId,
        jobLevelId: (await resolveJobLevel(tx, actor.tenantId, input)) ?? current.jobLevelId,
        businessUnitId: (await resolveLocation(tx, actor.tenantId, input.location)) ?? (input.location === null ? null : current.businessUnitId),
      };
      const moved = {
        orgUnit: next.orgUnitId !== current.orgUnitId,
        position: next.positionId !== current.positionId || next.jobLevelId !== current.jobLevelId,
        location: next.businessUnitId !== current.businessUnitId,
      };
      if (moved.orgUnit || moved.position || moved.location) {
        if (!next.orgUnitId || !next.positionId) throw badRequest("Informe a área e o cargo da pessoa.");
        const from = current.assignmentFrom ? later(day, current.assignmentFrom) : day;
        if (current.assignmentId) await tx.update(s.employmentAssignments).set({ validTo: from }).where(eq(s.employmentAssignments.id, current.assignmentId));
        await tx.insert(s.employmentAssignments).values({
          tenantId: actor.tenantId,
          userId,
          orgUnitId: next.orgUnitId,
          positionId: next.positionId,
          jobLevelId: next.jobLevelId,
          businessUnitId: next.businessUnitId,
          validFrom: from,
          reason: moved.orgUnit ? "transfer" : moved.position ? "position_change" : "correction",
          createdBy: actor.userId,
        });
        if (moved.orgUnit) {
          changed.add("orgUnit");
          await audit(tx, actor, "people.transferred", userId, meta, { from: current.orgUnitId, to: next.orgUnitId });
        }
        if (next.positionId !== current.positionId) changed.add("position");
        if (next.jobLevelId !== current.jobLevelId) changed.add("jobLevel");
        if (moved.location) changed.add("location");
      }

      // Gestor(a) (manager_relationships, com vigência).
      if (input.managerId !== undefined && input.managerId !== current.managerId) {
        if (input.managerId) {
          if (input.managerId === userId) throw badRequest("A pessoa não pode ser gestora de si mesma.");
          const [boss] = await tx.select({ id: s.users.id }).from(s.users).where(and(eq(s.users.id, input.managerId), eq(s.users.status, "active"), sql`${s.users.id} in (${MANAGER_IDS})`));
          if (!boss) throw badRequest("Escolha um(a) gestor(a) ativo(a) com o papel Gestor.");
          const [cycle] = rowsOf<{ ok: boolean }>(await tx.execute(sql`select ${input.managerId}::uuid in ${teamTreeSql(userId)} as ok`));
          if (cycle?.ok) throw badRequest("Esta pessoa faz parte da equipe de quem foi escolhido(a) como gestor(a). Escolha outra pessoa.");
        }
        const from = current.managerFrom ? later(day, current.managerFrom) : day;
        if (current.managerRelationshipId) await tx.update(s.managerRelationships).set({ validTo: from }).where(eq(s.managerRelationships.id, current.managerRelationshipId));
        if (input.managerId) await tx.insert(s.managerRelationships).values({ tenantId: actor.tenantId, userId, managerId: input.managerId, validFrom: from, createdBy: actor.userId });
        changed.add("manager");
        await audit(tx, actor, "people.manager_changed", userId, meta, { from: current.managerId, to: input.managerId });
      }

      fields = [...changed];
      if (fields.length) await audit(tx, actor, "people.updated", userId, meta, { fields });
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict(input.email ? "Este e-mail ou matrícula já está em uso." : "Esta matrícula já está em uso.");
    throw error;
  }
  // Novo e-mail: as sessões abertas da pessoa são encerradas.
  if (emailChanged) await revokeUserSessions(userId);
  return { id: userId, fields };
}

const rowsOf = <T>(result: unknown) => (result as { rows: T[] }).rows;

import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { JOB_LEVEL_NAMES, MANAGERIAL_POSITIONS } from "@/lib/job-catalog";
import { recordAudit } from "@/server/audit/audit";
import { sendInvite } from "@/server/auth/invite";
import type { AuthenticatedActor } from "@/server/auth/session";
import { hasTenantWide } from "@/server/authz/policy";
import * as s from "@/server/db/schema";
import { withTenant, type Tx } from "@/server/db/tenant";
import { badRequest, conflict, forbidden, notFound } from "@/server/http/errors";
import { logger } from "@/server/observability/logger";
import { MANAGER_IDS } from "./directory";
import type { PersonCreate } from "./schemas";

/**
 * Administração de pessoas (people.manage, sempre na empresa toda):
 * cadastro com convite, desativação/reativação e reenvio do convite.
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

async function audit(tx: Tx, actor: AuthenticatedActor, action: "people.created" | "people.invited" | "people.deactivated" | "people.reactivated", userId: string, meta: Meta, metadata?: Record<string, unknown>) {
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

import "server-only";
import { alias } from "drizzle-orm/pg-core";
import { and, asc, eq, gt, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { recordAudit } from "@/server/audit/audit";
import type { AuthenticatedActor } from "@/server/auth/session";
import { can } from "@/server/authz/policy";
import { accessibleUsersCondition, dbScopeResolver, orgSubtreeSql } from "@/server/authz/resolver";
import * as s from "@/server/db/schema";
import { withTenant, type Tx } from "@/server/db/tenant";
import { forbidden, notFound } from "@/server/http/errors";
import type { PeopleQuery, ProfileUpdate } from "./schemas";

/**
 * Pessoas. Separação deliberada:
 *  - dados PROFISSIONAIS (cargo, área, gestor, e-mail corporativo): people.directory.read
 *  - dados PESSOAIS (telefone, contrato, matrícula): people.profile.read_full
 * Ambos sempre limitados ao escopo do ator.
 */

const manager = alias(s.users, "manager");

function professionalColumns() {
  return {
    id: s.users.id,
    name: s.users.name,
    email: s.users.email,
    image: s.users.image,
    status: s.users.status,
    preferredName: s.employeeProfiles.preferredName,
    hireDate: s.employeeProfiles.hireDate,
    headline: s.employeeProfiles.headline,
    position: s.positions.name,
    level: s.jobLevels.name,
    orgUnitId: s.orgUnits.id,
    orgUnit: s.orgUnits.name,
    businessUnit: s.businessUnits.name,
    city: s.businessUnits.city,
    state: s.businessUnits.state,
    managerId: manager.id,
    managerName: manager.name,
  };
}

/** Pessoas com lotação e gestor VIGENTES. */
function peopleQuery(tx: Tx) {
  return tx
    .select(professionalColumns())
    .from(s.users)
    .leftJoin(s.employeeProfiles, eq(s.employeeProfiles.userId, s.users.id))
    .leftJoin(s.employmentAssignments, and(eq(s.employmentAssignments.userId, s.users.id), isNull(s.employmentAssignments.validTo)))
    .leftJoin(s.positions, eq(s.positions.id, s.employmentAssignments.positionId))
    .leftJoin(s.jobLevels, eq(s.jobLevels.id, s.employmentAssignments.jobLevelId))
    .leftJoin(s.orgUnits, eq(s.orgUnits.id, s.employmentAssignments.orgUnitId))
    .leftJoin(s.businessUnits, eq(s.businessUnits.id, s.employmentAssignments.businessUnitId))
    .leftJoin(s.managerRelationships, and(eq(s.managerRelationships.userId, s.users.id), isNull(s.managerRelationships.validTo)))
    .leftJoin(manager, eq(manager.id, s.managerRelationships.managerId))
    .$dynamic();
}

export type PersonRow = Awaited<ReturnType<typeof peopleQuery>>[number];

function encodeCursor(name: string, id: string) {
  return Buffer.from(JSON.stringify([name, id])).toString("base64url");
}

function decodeCursor(cursor: string): [string, string] | null {
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    return Array.isArray(value) && value.length === 2 && value.every((v) => typeof v === "string") ? (value as [string, string]) : null;
  } catch {
    return null;
  }
}

export async function listPeople(actor: AuthenticatedActor, query: PeopleQuery) {
  return withTenant(actor, async (tx) => {
    const conditions: SQL[] = [accessibleUsersCondition(actor, "people.directory.read", sql`${s.users.id}`)];
    if (query.status) conditions.push(eq(s.users.status, query.status));
    if (query.search) {
      const term = `%${query.search.replace(/[%_\\]/g, "\\$&")}%`;
      conditions.push(or(ilike(s.users.name, term), ilike(s.users.email, term))!);
    }
    if (query.orgUnitId) conditions.push(sql`${s.employmentAssignments.orgUnitId} in ${orgSubtreeSql(query.orgUnitId)}`);
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    if (cursor) conditions.push(or(gt(s.users.name, cursor[0]), and(eq(s.users.name, cursor[0]), gt(s.users.id, cursor[1])))!);

    const rows = await peopleQuery(tx)
      .where(and(...conditions))
      .orderBy(asc(s.users.name), asc(s.users.id))
      .limit(query.limit + 1);

    const items = rows.slice(0, query.limit);
    const last = items.at(-1);
    return { items, nextCursor: rows.length > query.limit && last ? encodeCursor(last.name, last.id) : null };
  });
}


async function fetchPerson(tx: Tx, userId: string): Promise<PersonRow | null> {
  const [row] = await peopleQuery(tx).where(eq(s.users.id, userId)).limit(1);
  return row ?? null;
}

export async function getPerson(actor: AuthenticatedActor, userId: string) {
  return withTenant(actor, async (tx) => {
    const resolver = dbScopeResolver(tx);
    // Fora do escopo → 404 (não revela a existência da pessoa).
    if (!(await can(actor, "people.directory.read", { kind: "user", userId }, resolver))) throw notFound();
    const person = await fetchPerson(tx, userId);
    if (!person) throw notFound();

    let personal: { employeeCode: string | null; phone: string | null; contractType: string; employmentStatus: string } | null = null;
    if (await can(actor, "people.profile.read_full", { kind: "user", userId }, resolver)) {
      const [row] = await tx
        .select({
          employeeCode: s.employeeProfiles.employeeCode,
          phone: s.employeeProfiles.phone,
          contractType: s.employeeProfiles.contractType,
          employmentStatus: s.employeeProfiles.employmentStatus,
        })
        .from(s.employeeProfiles)
        .where(eq(s.employeeProfiles.userId, userId));
      personal = row ?? null;
    }
    return { ...person, personal };
  });
}

export async function getMyProfile(actor: AuthenticatedActor) {
  return withTenant(actor, async (tx) => {
    const person = await fetchPerson(tx, actor.userId);
    if (!person) throw notFound();
    const [personal] = await tx
      .select({ phone: s.employeeProfiles.phone, contractType: s.employeeProfiles.contractType, employeeCode: s.employeeProfiles.employeeCode })
      .from(s.employeeProfiles)
      .where(eq(s.employeeProfiles.userId, actor.userId));
    const policies = await tx.select({ field: s.profileFieldPolicies.fieldKey, editable: s.profileFieldPolicies.editableByEmployee }).from(s.profileFieldPolicies);
    const directorate = person.orgUnitId ? await rootDirectorate(tx, person.orgUnitId) : null;
    return {
      ...person,
      directorate,
      personal: personal ?? null,
      editableFields: policies.filter((p) => p.editable).map((p) => p.field),
    };
  });
}

async function rootDirectorate(tx: Tx, orgUnitId: string): Promise<string | null> {
  const result = await tx.execute(sql`
    with recursive up(id, parent_id, name, type) as (
      select id, parent_id, name, type from org_units where id = ${orgUnitId}
      union
      select o.id, o.parent_id, o.name, o.type from org_units o join up on o.id = up.parent_id
    ) select name from up where type = 'directorate' limit 1
  `);
  return (result as unknown as { rows: { name: string }[] }).rows[0]?.name ?? null;
}

export async function updateMyProfile(actor: AuthenticatedActor, input: ProfileUpdate, meta: { ip: string | null; userAgent: string | null; requestId: string }) {
  return withTenant(actor, async (tx) => {
    const policies = await tx.select({ field: s.profileFieldPolicies.fieldKey, editable: s.profileFieldPolicies.editableByEmployee }).from(s.profileFieldPolicies);
    const editable = new Set(policies.filter((p) => p.editable).map((p) => p.field));
    const requested = Object.keys(input) as (keyof ProfileUpdate)[];
    const blocked = requested.filter((field) => !editable.has(field));
    if (blocked.length > 0) {
      throw forbidden(`Sua empresa não permite editar: ${blocked.join(", ")}.`);
    }

    const profileChanges: Partial<typeof s.employeeProfiles.$inferInsert> = {};
    if (input.preferredName !== undefined) profileChanges.preferredName = input.preferredName;
    if (input.phone !== undefined) profileChanges.phone = input.phone;
    if (input.headline !== undefined) profileChanges.headline = input.headline;
    if (Object.keys(profileChanges).length > 0) {
      await tx.update(s.employeeProfiles).set(profileChanges).where(eq(s.employeeProfiles.userId, actor.userId));
    }

    await recordAudit(tx, {
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      action: "people.profile_updated",
      resourceType: "user",
      resourceId: actor.userId,
      metadata: { fields: requested },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });
  });
}

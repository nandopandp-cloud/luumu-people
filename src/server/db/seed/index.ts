import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { PERMISSIONS } from "@/server/authz/permissions";
import { SYSTEM_ROLES, type SystemRoleKey } from "@/server/authz/system-roles";
import { hashPassword } from "@/server/auth/password";
import type { Database } from "../client";
import * as s from "../schema";
import { seedCommunication } from "./communication";
import { seedContent } from "./content";
import { seedSurveys } from "./surveys";
import { DEFAULT_EDITABLE_PROFILE_FIELDS, SEED_FEATURE_FLAGS, SEED_ORGANIZATIONS, seedEmail, type SeedOrganization } from "./data";

/**
 * Seed de catálogo (sempre) + organizações demonstrativas (somente fora de produção).
 * Roda com a role dona do schema. Idempotente: organizações existentes são ignoradas.
 */

/** Sincroniza o catálogo de permissões e as feature flags (necessário em todo ambiente). */
export async function syncCatalog(db: Database): Promise<void> {
  for (const [key, def] of Object.entries(PERMISSIONS)) {
    await db
      .insert(s.permissions)
      .values({ key, domain: def.domain, description: def.description })
      .onConflictDoUpdate({ target: s.permissions.key, set: { domain: def.domain, description: def.description } });
  }
  for (const flag of SEED_FEATURE_FLAGS) {
    await db
      .insert(s.featureFlags)
      .values({ key: flag.key, description: flag.description, defaultEnabled: flag.defaultEnabled })
      .onConflictDoNothing();
  }
  await syncSystemRoles(db);
}

/**
 * Mantém as permissões dos papéis de SISTEMA de todos os tenants iguais ao
 * código (system-roles.ts). Roda junto com as migrations (role dona do schema).
 */
export async function syncSystemRoles(db: Database): Promise<void> {
  const rows = await db.select({ id: s.roles.id, tenantId: s.roles.tenantId, key: s.roles.key }).from(s.roles).where(eq(s.roles.isSystem, true));
  for (const role of rows) {
    const definition = SYSTEM_ROLES.find((r) => r.key === role.key);
    if (!definition) continue;
    const current = await db.select({ key: s.rolePermissions.permissionKey }).from(s.rolePermissions).where(eq(s.rolePermissions.roleId, role.id));
    const have = new Set(current.map((c) => c.key));
    const want = new Set<string>(definition.permissions);
    const missing = [...want].filter((p) => !have.has(p));
    const extra = [...have].filter((p) => !want.has(p));
    if (missing.length) await db.insert(s.rolePermissions).values(missing.map((permissionKey) => ({ tenantId: role.tenantId, roleId: role.id, permissionKey })));
    for (const permissionKey of extra) {
      await db.delete(s.rolePermissions).where(and(eq(s.rolePermissions.roleId, role.id), eq(s.rolePermissions.permissionKey, permissionKey)));
    }
  }
}

/** Cria os papéis de sistema de um tenant. Exportado para o provisionamento de novos tenants. */
export async function createSystemRoles(db: Database, tenantId: string): Promise<Map<SystemRoleKey, string>> {
  const ids = new Map<SystemRoleKey, string>();
  for (const role of SYSTEM_ROLES) {
    const id = randomUUID();
    ids.set(role.key, id);
    await db.insert(s.roles).values({
      id,
      tenantId,
      key: role.key,
      name: role.name,
      description: role.description,
      isSystem: true,
      defaultScope: role.defaultScope,
    });
    if (role.permissions.length > 0) {
      await db.insert(s.rolePermissions).values(role.permissions.map((permissionKey) => ({ tenantId, roleId: id, permissionKey })));
    }
  }
  return ids;
}

export type SeededOrganization = { tenantId: string; users: Map<string, { id: string; email: string }>; orgUnits: Map<string, string> };

async function seedOrganization(db: Database, org: SeedOrganization, passwordHash: string): Promise<SeededOrganization | null> {
  const existing = await db.select({ id: s.organizations.id }).from(s.organizations).where(eq(s.organizations.slug, org.slug));
  if (existing.length > 0) return null;

  const tenantId = randomUUID();
  await db.insert(s.organizations).values({ id: tenantId, slug: org.slug, name: org.name, anonymityK: org.anonymityK });

  const businessUnits = new Map(org.businessUnits.map((bu) => [bu.code, randomUUID()]));
  await db.insert(s.businessUnits).values(org.businessUnits.map((bu) => ({ id: businessUnits.get(bu.code)!, tenantId, ...bu })));

  const orgUnits = new Map(org.orgUnits.map((u) => [u.code, randomUUID()]));
  for (const unit of org.orgUnits) {
    await db.insert(s.orgUnits).values({
      id: orgUnits.get(unit.code)!,
      tenantId,
      parentId: unit.parent ? orgUnits.get(unit.parent)! : null,
      type: unit.type,
      name: unit.name,
      code: unit.code,
    });
  }

  const positions = new Map(org.positions.map((p) => [p.name, randomUUID()]));
  await db.insert(s.positions).values(org.positions.map((p) => ({ id: positions.get(p.name)!, tenantId, name: p.name, isManagerial: p.managerial ?? false })));

  const levels = new Map(org.levels.map((l) => [l.name, randomUUID()]));
  await db.insert(s.jobLevels).values(org.levels.map((l) => ({ id: levels.get(l.name)!, tenantId, ...l })));

  const roleIds = await createSystemRoles(db, tenantId);

  const users = new Map(org.people.map((p) => [p.key, { id: randomUUID(), email: seedEmail(p, org.emailDomain) }]));
  const ref = (key: string) => {
    const u = users.get(key);
    if (!u) throw new Error(`Seed: pessoa desconhecida "${key}" em ${org.slug}`);
    return u.id;
  };

  await db.insert(s.users).values(
    org.people.map((p) => ({ id: ref(p.key), tenantId, name: p.name, email: users.get(p.key)!.email, emailVerified: true, status: "active" as const })),
  );
  await db.insert(s.accounts).values(
    org.people.map((p) => ({ userId: ref(p.key), accountId: ref(p.key), providerId: "credential", password: passwordHash })),
  );
  await db.insert(s.employeeProfiles).values(
    org.people.map((p, index) => ({
      userId: ref(p.key),
      tenantId,
      employeeCode: `${org.slug.slice(0, 3).toUpperCase()}-${String(index + 1).padStart(4, "0")}`,
      hireDate: p.hireDate,
      contractType: p.contract ?? "clt",
      headline: p.headline ?? null,
    })),
  );
  await db.insert(s.employmentAssignments).values(
    org.people.map((p) => ({
      tenantId,
      userId: ref(p.key),
      orgUnitId: orgUnits.get(p.orgUnit)!,
      businessUnitId: businessUnits.get(p.businessUnit)!,
      positionId: positions.get(p.position)!,
      jobLevelId: levels.get(p.level)!,
      validFrom: p.hireDate,
      reason: "hire" as const,
    })),
  );
  const withManager = org.people.filter((p) => p.manager);
  if (withManager.length > 0) {
    await db.insert(s.managerRelationships).values(
      withManager.map((p) => ({ tenantId, userId: ref(p.key), managerId: ref(p.manager!), validFrom: p.hireDate })),
    );
  }

  const scopeOf = (key: SystemRoleKey) => SYSTEM_ROLES.find((r) => r.key === key)!.defaultScope;
  await db.insert(s.userRoles).values(
    org.people.flatMap((p) =>
      (["employee", ...(p.roles ?? [])] as SystemRoleKey[]).map((roleKey) => ({
        tenantId,
        userId: ref(p.key),
        roleId: roleIds.get(roleKey)!,
        scopeType: scopeOf(roleKey),
      })),
    ),
  );

  await db.insert(s.profileFieldPolicies).values(
    DEFAULT_EDITABLE_PROFILE_FIELDS.map((fieldKey) => ({ tenantId, fieldKey, editableByEmployee: true })),
  );
  if (org.tags.length > 0) {
    await db.insert(s.orgTags).values(org.tags.map((name) => ({ tenantId, name })));
  }

  await db.insert(s.auditLogs).values({
    tenantId,
    actorType: "system",
    action: "tenant.seeded",
    resourceType: "organization",
    resourceId: tenantId,
    metadata: { people: org.people.length },
  });

  return { tenantId, users, orgUnits };
}

export type SeedResult = Map<string, SeededOrganization>;

export async function seedDemo(db: Database, password: string): Promise<SeedResult> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("O seed demonstrativo não roda em produção.");
  }
  const passwordHash = await hashPassword(password);
  const result: SeedResult = new Map();
  await db.transaction(async (tx) => {
    const t = tx as unknown as Database;
    await syncCatalog(t);
    for (const org of SEED_ORGANIZATIONS) {
      const seeded = await seedOrganization(t, org, passwordHash);
      if (seeded) {
        await seedContent(t, seeded.tenantId, [...seeded.users.values()].map((u) => u.id));
        await seedCommunication(t, seeded.tenantId);
        await seedSurveys(t, seeded.tenantId);
        await enableLearningFor(t, seeded);
        result.set(org.slug, seeded);
      }
    }
  });
  return result;
}

/**
 * Cursos/trilhas/biblioteca nascem desligados. Para testes de ponta a ponta,
 * SEED_LEARNING_USERS (e-mails separados por vírgula) liga os módulos só para
 * essas pessoas — o seed demonstrativo nunca roda em produção.
 */
async function enableLearningFor(db: Database, org: SeededOrganization) {
  const emails = new Set((process.env.SEED_LEARNING_USERS ?? "").split(",").map((e) => e.trim()).filter(Boolean));
  for (const [, user] of org.users) {
    if (!emails.has(user.email)) continue;
    await db.insert(s.featureFlagOverrides).values(
      ["module_learning", "module_library"].map((flagKey) => ({ flagKey, tenantId: org.tenantId, userId: user.id, enabled: true })),
    );
  }
}

export async function isDatabaseEmpty(db: Database): Promise<boolean> {
  const result = await db.execute(sql`select count(*)::int as count from organizations`);
  const rows = (result as unknown as { rows: { count: number }[] }).rows;
  return Number(rows[0]?.count ?? 0) === 0;
}

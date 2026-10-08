import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { hashPassword } from "../src/server/auth/password";
import { SYSTEM_ROLES } from "../src/server/authz/system-roles";
import { ownerDatabase, schema as s } from "./_db";

/**
 * Importa/atualiza a estrutura organizacional e as pessoas de UMA empresa a
 * partir de um JSON (até a importação pela tela de gestão, Fase 5).
 *
 *   pnpm org:import caminho/estrutura.json
 *
 * Idempotente: áreas (por código), cargos e níveis (por nome) e pessoas (por
 * e-mail) existentes são reaproveitados. Pessoas novas recebem uma senha
 * aleatória comum, exibida UMA vez. Nunca coloque este JSON no repositório
 * se contiver dados reais de pessoas.
 */
const input = z
  .strictObject({
    tenant: z.string(),
    orgUnits: z.array(z.strictObject({ code: z.string(), name: z.string(), type: z.enum(["directorate", "area", "subarea"]), parent: z.string().optional() })),
    positions: z.array(z.strictObject({ name: z.string(), managerial: z.boolean().optional() })),
    levels: z.array(z.strictObject({ name: z.string(), rank: z.number().int() })),
    people: z.array(
      z.strictObject({
        name: z.string(),
        email: z.email(),
        orgUnit: z.string(),
        position: z.string(),
        level: z.string(),
        hireDate: z.iso.date(),
        manager: z.email().optional(),
        roles: z.array(z.enum(["manager", "editor", "people", "admin"])).optional(),
        headline: z.string().optional(),
      }),
    ),
  })
  .parse(JSON.parse(readFileSync(process.argv[2] ?? "", "utf8")));

const { db, pool } = ownerDatabase();
try {
  const sharedPassword = randomBytes(15).toString("base64url");
  const passwordHash = await hashPassword(sharedPassword);
  let created = 0;

  await db.transaction(async (tx) => {
    const t = tx as unknown as typeof db;
    const [org] = await t.select({ id: s.organizations.id }).from(s.organizations).where(eq(s.organizations.slug, input.tenant));
    if (!org) throw new Error(`Empresa "${input.tenant}" não encontrada.`);
    const tenantId = org.id;

    // Áreas (pais antes dos filhos, na ordem do arquivo).
    const units = new Map<string, string>();
    for (const u of input.orgUnits) {
      const [found] = await t.select({ id: s.orgUnits.id }).from(s.orgUnits).where(and(eq(s.orgUnits.tenantId, tenantId), eq(s.orgUnits.code, u.code)));
      const id = found?.id ?? randomUUID();
      if (!found) {
        await t.insert(s.orgUnits).values({ id, tenantId, code: u.code, name: u.name, type: u.type, parentId: u.parent ? units.get(u.parent)! : null });
      }
      units.set(u.code, id);
    }

    const positions = new Map<string, string>();
    for (const p of input.positions) {
      const [found] = await t.select({ id: s.positions.id }).from(s.positions).where(and(eq(s.positions.tenantId, tenantId), eq(s.positions.name, p.name)));
      const id = found?.id ?? randomUUID();
      if (!found) await t.insert(s.positions).values({ id, tenantId, name: p.name, isManagerial: p.managerial ?? false });
      positions.set(p.name, id);
    }

    const levels = new Map<string, string>();
    for (const l of input.levels) {
      const [found] = await t.select({ id: s.jobLevels.id }).from(s.jobLevels).where(and(eq(s.jobLevels.tenantId, tenantId), eq(s.jobLevels.name, l.name)));
      const id = found?.id ?? randomUUID();
      if (!found) await t.insert(s.jobLevels).values({ id, tenantId, name: l.name, rank: l.rank });
      levels.set(l.name, id);
    }

    const roles = new Map((await t.select({ id: s.roles.id, key: s.roles.key }).from(s.roles).where(eq(s.roles.tenantId, tenantId))).map((r) => [r.key, r.id]));
    const scopeOf = (key: string) => SYSTEM_ROLES.find((r) => r.key === key)!.defaultScope;

    // Pessoas: primeiro garante todas as contas, depois lotação e gestor.
    const userIds = new Map<string, string>();
    for (const p of input.people) {
      const email = p.email.toLowerCase();
      const [found] = await t.select({ id: s.users.id, tenantId: s.users.tenantId }).from(s.users).where(eq(s.users.email, email));
      if (found && found.tenantId !== tenantId) throw new Error(`${email} pertence a outra empresa.`);
      const id = found?.id ?? randomUUID();
      if (!found) {
        await t.insert(s.users).values({ id, tenantId, name: p.name, email, emailVerified: true, status: "active" });
        await t.insert(s.accounts).values({ userId: id, accountId: id, providerId: "credential", password: passwordHash });
        await t.insert(s.employeeProfiles).values({ userId: id, tenantId, hireDate: p.hireDate, headline: p.headline ?? null });
        await t.insert(s.userRoles).values({ tenantId, userId: id, roleId: roles.get("employee")!, scopeType: "SELF" });
        await t.insert(s.auditLogs).values({ tenantId, actorType: "system", action: "people.created", resourceType: "user", resourceId: id, metadata: { source: "import" } });
        created++;
      }
      userIds.set(email, id);
      for (const role of p.roles ?? []) {
        const [has] = await t
          .select({ id: s.userRoles.id })
          .from(s.userRoles)
          .where(and(eq(s.userRoles.userId, id), eq(s.userRoles.roleId, roles.get(role)!), isNull(s.userRoles.revokedAt)));
        if (!has) await t.insert(s.userRoles).values({ tenantId, userId: id, roleId: roles.get(role)!, scopeType: scopeOf(role) });
      }
    }

    for (const p of input.people) {
      const userId = userIds.get(p.email.toLowerCase())!;
      const [current] = await t
        .select({ id: s.employmentAssignments.id })
        .from(s.employmentAssignments)
        .where(and(eq(s.employmentAssignments.userId, userId), isNull(s.employmentAssignments.validTo)));
      if (!current) {
        await t.insert(s.employmentAssignments).values({
          tenantId,
          userId,
          orgUnitId: units.get(p.orgUnit)!,
          positionId: positions.get(p.position)!,
          jobLevelId: levels.get(p.level)!,
          validFrom: p.hireDate,
          reason: "hire",
        });
      }
      if (p.manager) {
        const [hasManager] = await t
          .select({ id: s.managerRelationships.id })
          .from(s.managerRelationships)
          .where(and(eq(s.managerRelationships.userId, userId), isNull(s.managerRelationships.validTo)));
        if (!hasManager) {
          await t.insert(s.managerRelationships).values({ tenantId, userId, managerId: userIds.get(p.manager.toLowerCase())!, validFrom: p.hireDate });
        }
      }
    }
  });

  console.log(`✓ Estrutura importada. Pessoas novas: ${created}.`);
  if (created > 0) console.log(`  Senha das contas novas (exibida só agora): ${sharedPassword}`);
} finally {
  await pool.end();
}

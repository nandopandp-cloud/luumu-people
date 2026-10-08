import { randomBytes, randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { hashPassword } from "../src/server/auth/password";
import { createSystemRoles, syncCatalog } from "../src/server/db/seed";
import { DEFAULT_EDITABLE_PROFILE_FIELDS } from "../src/server/db/seed/data";
import { ownerDatabase, schema as s } from "./_db";

/**
 * Provisiona uma empresa real com seu primeiro Administrador (até a console de
 * plataforma da Fase 5).
 *
 *   pnpm tsx scripts/create-tenant.ts --slug acme --name "Acme S.A." \
 *     --admin-email ana@acme.com --admin-name "Ana Souza"
 *
 * Gera uma senha temporária forte, exibida UMA vez. Peça à pessoa que entre e
 * troque a senha em "Esqueci minha senha".
 */
const { values } = parseArgs({
  options: {
    slug: { type: "string" },
    name: { type: "string" },
    "admin-email": { type: "string" },
    "admin-name": { type: "string" },
    k: { type: "string", default: "5" },
  },
});
const slug = values.slug?.trim();
const name = values.name?.trim();
const email = values["admin-email"]?.trim().toLowerCase();
const adminName = values["admin-name"]?.trim();
const k = Number(values.k);
if (!slug || !name || !email || !adminName || ![5, 7, 10].includes(k)) {
  console.error('Uso: --slug acme --name "Acme S.A." --admin-email ana@acme.com --admin-name "Ana Souza" [--k 5|7|10]');
  process.exit(1);
}

const { db, pool } = ownerDatabase();
try {
  const temporaryPassword = randomBytes(18).toString("base64url");
  const passwordHash = await hashPassword(temporaryPassword);
  await db.transaction(async (tx) => {
    const t = tx as unknown as typeof db;
    await syncCatalog(t);
    if ((await t.select({ id: s.organizations.id }).from(s.organizations).where(eq(s.organizations.slug, slug))).length > 0) {
      throw new Error(`Já existe uma empresa com o slug "${slug}".`);
    }
    const tenantId = randomUUID();
    const userId = randomUUID();
    await t.insert(s.organizations).values({ id: tenantId, slug, name, anonymityK: k });
    const roles = await createSystemRoles(t, tenantId);
    await t.insert(s.users).values({ id: userId, tenantId, name: adminName, email, emailVerified: true, status: "active" });
    await t.insert(s.accounts).values({ userId, accountId: userId, providerId: "credential", password: passwordHash });
    await t.insert(s.employeeProfiles).values({ userId, tenantId, hireDate: new Date().toISOString().slice(0, 10) });
    await t.insert(s.userRoles).values([
      { tenantId, userId, roleId: roles.get("employee")!, scopeType: "SELF" },
      { tenantId, userId, roleId: roles.get("admin")!, scopeType: "TENANT" },
    ]);
    await t.insert(s.profileFieldPolicies).values(DEFAULT_EDITABLE_PROFILE_FIELDS.map((fieldKey) => ({ tenantId, fieldKey, editableByEmployee: true })));
    await t.insert(s.auditLogs).values({ tenantId, actorType: "system", action: "tenant.seeded", resourceType: "organization", resourceId: tenantId, metadata: { provisioned: true } });
  });
  console.log(`✓ Empresa "${name}" criada. Administrador(a): ${email}`);
  console.log(`  Senha temporária (exibida só agora): ${temporaryPassword}`);
} finally {
  await pool.end();
}

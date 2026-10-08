import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { withTenant } from "@/server/db/tenant";
import * as s from "@/server/db/schema";
import { asRole, expectDbError, tenantOf, testDatabase, userOf } from "../support/db";

/**
 * TESTE 4 (nível banco): usuário da empresa A não acessa dados da empresa B,
 * mesmo que a camada de API falhe. TESTE 8 (nível banco): tenant_id forjado
 * não é aceito.
 */
describe("isolamento entre tenants (RLS)", () => {
  let aurora: Awaited<ReturnType<typeof tenantOf>>;
  let horizonte: Awaited<ReturnType<typeof tenantOf>>;

  beforeAll(async () => {
    await testDatabase();
    aurora = await tenantOf("aurora");
    horizonte = await tenantOf("horizonte");
  });

  it("consultas só enxergam o próprio tenant", async () => {
    const rows = await withTenant({ tenantId: aurora.tenantId, userId: null }, (tx) => tx.select({ tenantId: s.users.tenantId }).from(s.users));
    expect(rows.length).toBe(aurora.users.size);
    expect(new Set(rows.map((r) => r.tenantId))).toEqual(new Set([aurora.tenantId]));
  });

  it("buscar diretamente o id de um usuário de outro tenant retorna vazio", async () => {
    const sergio = await userOf("horizonte", "sergio");
    const rows = await withTenant({ tenantId: aurora.tenantId, userId: null }, (tx) => tx.select().from(s.users).where(eq(s.users.id, sergio.id)));
    expect(rows).toEqual([]);
  });

  it("não é possível inserir linhas em outro tenant (WITH CHECK)", async () => {
    await expectDbError(
      withTenant({ tenantId: aurora.tenantId, userId: null }, (tx) =>
        tx.insert(s.orgTags).values({ tenantId: horizonte.tenantId, name: "invasão" }),
      ),
      /row-level security/,
    );
  });

  it("tenant_id não pode ser alterado pelo runtime", async () => {
    const fernando = await userOf("aurora", "fernando");
    await expectDbError(
      withTenant({ tenantId: aurora.tenantId, userId: null }, (tx) =>
        tx.execute(sql`update users set tenant_id = ${horizonte.tenantId} where id = ${fernando.id}`),
      ),
      /permission denied/,
    );
  });

  it("FK composta impede referência cruzada entre tenants, mesmo para o dono do schema", async () => {
    const { db } = await testDatabase();
    const fernando = await userOf("aurora", "fernando");
    const horizonteUnit = horizonte.orgUnits.get("pedagogico")!;
    const position = await db.select({ id: s.positions.id }).from(s.positions).where(eq(s.positions.tenantId, aurora.tenantId)).limit(1);
    await expectDbError(
      db.insert(s.employmentAssignments).values({
        tenantId: aurora.tenantId,
        userId: fernando.id,
        orgUnitId: horizonteUnit,
        positionId: position[0]!.id,
        // Registro histórico (encerrado) para não colidir com a lotação vigente.
        validFrom: "2020-01-01",
        validTo: "2021-01-01",
        reason: "transfer",
      }),
      /foreign key/,
    );
  });

  it("sem contexto de tenant, a role da aplicação não vê nada (fail closed)", async () => {
    const rows = await asRole("luumu_app", (db) => db.select({ id: s.users.id }).from(s.users));
    expect(rows).toEqual([]);
  });

  it("a role da aplicação não lê sessões nem senhas", async () => {
    await expectDbError(asRole("luumu_app", (db) => db.select().from(s.sessions)), /permission denied/);
    await expectDbError(asRole("luumu_app", (db) => db.select().from(s.accounts)), /permission denied/);
  });

  it("a role de autenticação não lê dados de RH", async () => {
    await expectDbError(asRole("luumu_auth", (db) => db.select().from(s.employeeProfiles)), /permission denied/);
    await expectDbError(asRole("luumu_auth", (db) => db.select().from(s.userRoles)), /permission denied/);
  });

  it("papéis de sistema não podem ser alterados ou removidos pela aplicação", async () => {
    const updated = await withTenant({ tenantId: aurora.tenantId, userId: null }, (tx) =>
      tx.update(s.roles).set({ name: "Hackeado" }).where(eq(s.roles.key, "admin")).returning({ id: s.roles.id }),
    );
    expect(updated).toEqual([]);
    const removed = await withTenant({ tenantId: aurora.tenantId, userId: null }, (tx) =>
      tx.delete(s.roles).where(eq(s.roles.key, "employee")).returning({ id: s.roles.id }),
    );
    expect(removed).toEqual([]);
  });

  it("permissões de papéis de sistema não podem ser ampliadas pela aplicação", async () => {
    await expectDbError(
      withTenant({ tenantId: aurora.tenantId, userId: null }, async (tx) => {
        const [employee] = await tx.select({ id: s.roles.id }).from(s.roles).where(eq(s.roles.key, "employee"));
        await tx.insert(s.rolePermissions).values({ tenantId: aurora.tenantId, roleId: employee!.id, permissionKey: "audit.read" });
      }),
      /row-level security/,
    );
  });
});

import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { expectDbError, testDatabase } from "../support/db";

/**
 * Introspecção do schema: garante que nenhuma tabela nasce sem RLS, policies e
 * grants explícitos, e que colunas críticas são imutáveis para o runtime.
 */

type Row = Record<string, unknown>;

/** Lista SQL de literais: ('a', 'b'). */
const list = (values: string[]) => sql`(${sql.join(values.map((v) => sql`${v}`), sql`, `)})`;

async function query<T extends Row>(statement: ReturnType<typeof sql>): Promise<T[]> {
  const { db } = await testDatabase();
  const result = await db.execute(statement);
  return (result as unknown as { rows: T[] }).rows;
}

const AUTH_TABLES = ["sessions", "accounts", "verifications", "two_factors", "rate_limits", "login_throttles"];
const APPEND_ONLY_OR_HISTORY = ["audit_logs", "user_roles", "employment_assignments", "manager_relationships"];

describe("segurança do schema", () => {
  beforeAll(async () => {
    await testDatabase();
  });

  it("toda tabela do schema public tem RLS habilitada", async () => {
    const rows = await query<{ tablename: string; rowsecurity: boolean }>(
      sql`select tablename, rowsecurity from pg_tables where schemaname = 'public'`,
    );
    expect(rows.length).toBeGreaterThan(20);
    expect(rows.filter((r) => !r.rowsecurity).map((r) => r.tablename)).toEqual([]);
  });

  it("toda tabela tem ao menos uma policy", async () => {
    const rows = await query<{ tablename: string }>(sql`
      select t.tablename from pg_tables t
      where t.schemaname = 'public'
        and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.tablename)
    `);
    expect(rows.map((r) => r.tablename)).toEqual([]);
  });

  it("toda tabela com tenant_id tem policy de isolamento para luumu_app", async () => {
    const rows = await query<{ table_name: string }>(sql`
      select c.table_name from information_schema.columns c
      where c.table_schema = 'public' and c.column_name = 'tenant_id'
        and not exists (
          select 1 from pg_policies p
          where p.tablename = c.table_name and 'luumu_app' = any(p.roles)
            and p.qual like '%app.current_tenant_id()%'
        )
    `);
    expect(rows.map((r) => r.table_name)).toEqual([]);
  });

  it("luumu_app não tem nenhum privilégio nas tabelas de autenticação", async () => {
    const rows = await query<{ table_name: string; privilege_type: string }>(sql`
      select table_name, privilege_type from information_schema.role_table_grants
      where grantee = 'luumu_app' and table_name in ${list(AUTH_TABLES)}
    `);
    expect(rows).toEqual([]);
  });

  it("luumu_auth não tem privilégio em tabelas de negócio", async () => {
    const rows = await query<{ table_name: string }>(sql`
      select distinct table_name from information_schema.role_table_grants
      where grantee = 'luumu_auth' and table_name not in ${list([...AUTH_TABLES, "users"])}
    `);
    expect(rows).toEqual([]);
  });

  it("nenhuma role de runtime pode alterar tenant_id, id ou created_at", async () => {
    const rows = await query<{ table_name: string; column_name: string; grantee: string }>(sql`
      select table_name, column_name, grantee from information_schema.column_privileges
      where grantee in ('luumu_app', 'luumu_auth') and privilege_type = 'UPDATE'
        and column_name in ('tenant_id', 'id', 'created_at', 'user_id')
        and not (grantee = 'luumu_auth' and table_name in ${list(AUTH_TABLES)})
    `);
    expect(rows).toEqual([]);
  });

  it("histórico e auditoria não podem ser apagados pelo runtime", async () => {
    const rows = await query<{ table_name: string }>(sql`
      select table_name from information_schema.role_table_grants
      where grantee = 'luumu_app' and privilege_type in ('DELETE', 'TRUNCATE')
        and table_name in ${list(APPEND_ONLY_OR_HISTORY)}
    `);
    expect(rows).toEqual([]);
  });

  it("audit_logs rejeita UPDATE e DELETE até para o dono do schema", async () => {
    const { db } = await testDatabase();
    await expectDbError(db.execute(sql`update audit_logs set action = 'x'`), /somente-inserção/);
    await expectDbError(db.execute(sql`delete from audit_logs`), /somente-inserção/);
  });

  it("roles de runtime não são donas de nenhuma tabela nem ignoram RLS", async () => {
    const owned = await query<{ tablename: string }>(sql`
      select tablename from pg_tables where schemaname = 'public' and tableowner in ('luumu_app', 'luumu_auth')
    `);
    expect(owned).toEqual([]);
    const bypass = await query<{ rolname: string }>(sql`
      select rolname from pg_roles where rolname in ('luumu_app', 'luumu_auth') and (rolbypassrls or rolsuper)
    `);
    expect(bypass).toEqual([]);
  });

  it("login de runtime NOINHERIT (produção) não tem acesso fora de withTenant e opera via SET ROLE", async () => {
    const { db } = await testDatabase();
    await db.execute(sql.raw("create role luumu_app_login_test login noinherit"));
    await db.execute(sql.raw("grant luumu_app to luumu_app_login_test"));
    await expectDbError(
      db.transaction(async (tx) => {
        await tx.execute(sql.raw("set local role luumu_app_login_test"));
        await tx.execute(sql`select id from users limit 1`);
      }),
      /permission denied/,
    );
    const rows = await db.transaction(async (tx) => {
      await tx.execute(sql.raw("set local role luumu_app_login_test"));
      await tx.execute(sql.raw("set local role luumu_app"));
      const result = await tx.execute(sql`select count(*)::int as n from users`);
      return (result as unknown as { rows: { n: number }[] }).rows;
    });
    // Sem app.tenant_id definido: a RLS não devolve nada (fail closed).
    expect(rows[0]?.n).toBe(0);
  });
});

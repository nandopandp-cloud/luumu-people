import { ownerDatabase } from "./_db";

/**
 * Cria/atualiza os LOGINS de runtime (rodar uma vez por banco/branch, após as migrations):
 *
 *   luumu_app_login  → NOINHERIT, membro de luumu_app. Fora de withTenant() não tem
 *                      privilégio algum; dentro, faz SET LOCAL ROLE luumu_app (RLS).
 *   luumu_auth_login → membro de luumu_auth (Better Auth: apenas tabelas de autenticação).
 *
 * IMPORTANTE (Neon): crie estes logins por SQL (este script), não pelo console do
 * Neon — roles criadas pelo console entram em neon_superuser e ignorariam a RLS.
 */
const appPassword = process.env.LUUMU_APP_LOGIN_PASSWORD;
const authPassword = process.env.LUUMU_AUTH_LOGIN_PASSWORD;
for (const [name, value] of [["LUUMU_APP_LOGIN_PASSWORD", appPassword], ["LUUMU_AUTH_LOGIN_PASSWORD", authPassword]] as const) {
  if (!value || value.length < 24) {
    console.error(`Defina ${name} com pelo menos 24 caracteres (ex.: openssl rand -base64 32).`);
    process.exit(1);
  }
}

const { pool } = ownerDatabase();
const client = await pool.connect();
try {
  const upsertLogin = async (login: string, group: string, password: string, inherit: boolean) => {
    const exists = await client.query("select 1 from pg_roles where rolname = $1", [login]);
    const literal = client.escapeLiteral(password);
    const attrs = `LOGIN ${inherit ? "INHERIT" : "NOINHERIT"} NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`;
    await client.query(exists.rowCount ? `ALTER ROLE ${login} WITH ${attrs} PASSWORD ${literal}` : `CREATE ROLE ${login} WITH ${attrs} PASSWORD ${literal}`);
    await client.query(`GRANT ${group} TO ${login}`);
    console.log(`✓ ${login} (membro de ${group}, ${inherit ? "INHERIT" : "NOINHERIT"})`);
  };
  await upsertLogin("luumu_app_login", "luumu_app", appPassword!, false);
  await upsertLogin("luumu_auth_login", "luumu_auth", authPassword!, true);
  console.log("\nAgora configure na Vercel DATABASE_URL (luumu_app_login) e DATABASE_URL_AUTH (luumu_auth_login), usando o endpoint POOLED.");
} finally {
  client.release();
  await pool.end();
}

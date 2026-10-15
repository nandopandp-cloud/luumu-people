import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as profileRoute from "@/app/api/v1/me/profile/route";
import { getAuth } from "@/server/auth/auth";
import { resolveActor } from "@/server/auth/session";
import { headersWith, signIn } from "../support/auth";
import { TEST_PASSWORD, testDatabase, userOf } from "../support/db";
import { call } from "../support/http";

describe("senha provisória: troca obrigatória no primeiro acesso", () => {
  beforeAll(async () => {
    await testDatabase();
  });

  it("bloqueia a API até a troca; não aceita repetir a senha; libera depois", async () => {
    const helena = await userOf("aurora", "helena");
    const { db } = await testDatabase();
    await db.execute(sql`update users set must_change_password = true where id = ${helena.id}`);

    const session = await signIn("aurora", "helena");
    const actor = await resolveActor(headersWith(session.cookie));
    expect(actor?.mustChangePassword).toBe(true);
    const blocked = await call(profileRoute.GET, { path: "/api/v1/me/profile", cookie: session.cookie });
    expect(blocked.status).toBe(403);
    expect(blocked.json.detail).toMatch(/Crie sua senha/);

    const auth = await getAuth();
    const headers = headersWith(session.cookie, { origin: "http://localhost:3000" });
    await expect(auth.api.changePassword({ body: { currentPassword: TEST_PASSWORD, newPassword: TEST_PASSWORD }, headers })).rejects.toMatchObject({ body: { message: "A nova senha precisa ser diferente da atual." } });

    const changed = await auth.api.changePassword({ body: { currentPassword: TEST_PASSWORD, newPassword: "MinhaSenhaNova#2026", revokeOtherSessions: false }, headers, asResponse: true });
    expect(changed.status).toBe(200);
    const flag = (await db.execute(sql`select must_change_password as v from users where id = ${helena.id}`)) as unknown as { rows: { v: boolean }[] };
    expect(flag.rows[0]!.v).toBe(false);

    const after = await signIn("aurora", "helena", "MinhaSenhaNova#2026");
    expect((await call(profileRoute.GET, { path: "/api/v1/me/profile", cookie: after.cookie })).status).toBe(200);
  });
});

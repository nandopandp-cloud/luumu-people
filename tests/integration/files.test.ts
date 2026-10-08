import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as fileRoute from "@/app/api/v1/files/[id]/route";
import * as filesRoute from "@/app/api/v1/files/route";
import * as avatarRoute from "@/app/api/v1/me/avatar/route";
import * as s from "@/server/db/schema";
import { signIn } from "../support/auth";
import { testDatabase } from "../support/db";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82]);
const ORIGIN = "http://localhost:3000";

async function upload(handler: typeof filesRoute.POST, url: string, cookie: string, bytes: Uint8Array, name: string) {
  const form = new FormData();
  form.set("file", new File([bytes as Uint8Array<ArrayBuffer>], name));
  const response = await handler(
    new Request(`${ORIGIN}${url}`, { method: "POST", body: form, headers: { cookie, origin: ORIGIN, "sec-fetch-site": "same-origin" } }),
    { params: Promise.resolve({}) },
  );
  return { status: response.status, json: await response.json().catch(() => null) };
}

async function download(id: string, cookie: string) {
  return fileRoute.GET(new Request(`${ORIGIN}/api/v1/files/${id}`, { headers: { cookie } }), { params: Promise.resolve({ id }) });
}

describe("arquivos", () => {
  beforeAll(async () => {
    process.env.LOCAL_STORAGE_DIR = mkdtempSync(path.join(tmpdir(), "luumu-test-"));
    await testDatabase();
  });

  it("colaborador troca a própria foto; o arquivo é servido com cabeçalhos seguros", async () => {
    const fernando = await signIn("aurora", "fernando");
    const res = await upload(avatarRoute.POST as never, "/api/v1/me/avatar", fernando.cookie, PNG, "minha foto.png");
    expect(res.status).toBe(200);
    const id = res.json.id as string;

    const { db } = await testDatabase();
    const [user] = await db.select({ image: s.users.image }).from(s.users).where(eq(s.users.id, fernando.userId));
    expect(user?.image).toBe(`/api/v1/files/${id}`);

    const file = await download(id, fernando.cookie);
    expect(file.status).toBe(200);
    expect(file.headers.get("content-type")).toBe("image/png");
    expect(file.headers.get("x-content-type-options")).toBe("nosniff");
    expect(file.headers.get("content-security-policy")).toContain("sandbox");
    expect(file.headers.get("cache-control")).toContain("private");
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(PNG);
  });

  it("arquivo disfarçado (HTML com nome .png) é recusado", async () => {
    const fernando = await signIn("aurora", "fernando");
    const res = await upload(avatarRoute.POST as never, "/api/v1/me/avatar", fernando.cookie, new TextEncoder().encode("<html><script>alert(1)</script>"), "foto.png");
    expect(res.status).toBe(400);
    expect(res.json.detail).toMatch(/Formato não aceito/);
  });

  it("colaborador não envia capa de curso; editor envia", async () => {
    const fernando = await signIn("aurora", "fernando");
    expect((await upload(filesRoute.POST, "/api/v1/files?purpose=course_cover", fernando.cookie, PNG, "capa.png")).status).toBe(403);
    const rafael = await signIn("aurora", "rafael");
    expect((await upload(filesRoute.POST, "/api/v1/files?purpose=course_cover", rafael.cookie, PNG, "capa.png")).status).toBe(201);
  });

  it("pessoa de outra empresa não acessa o arquivo (404) e sem sessão é 401", async () => {
    const rafael = await signIn("aurora", "rafael");
    const res = await upload(filesRoute.POST, "/api/v1/files?purpose=course_cover", rafael.cookie, PNG, "capa.png");
    const sergio = await signIn("horizonte", "sergio");
    expect((await download(res.json.id, sergio.cookie)).status).toBe(404);
    expect((await download(res.json.id, "")).status).toBe(401);
  });

  it("empresa que bloqueia edição da foto recebe 403", async () => {
    const { db } = await testDatabase();
    const igor = await signIn("horizonte", "igor");
    await db.update(s.profileFieldPolicies).set({ editableByEmployee: false }).where(eq(s.profileFieldPolicies.tenantId, igor.tenantId));
    expect((await upload(avatarRoute.POST as never, "/api/v1/me/avatar", igor.cookie, PNG, "foto.png")).status).toBe(403);
  });
});

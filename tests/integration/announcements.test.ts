import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as archiveRoute from "@/app/api/v1/announcements/[id]/archive/route";
import * as publishRoute from "@/app/api/v1/announcements/[id]/publish/route";
import * as itemRoute from "@/app/api/v1/announcements/[id]/route";
import * as createRoute from "@/app/api/v1/announcements/route";
import { resolveActor } from "@/server/auth/session";
import * as s from "@/server/db/schema";
import { getAnnouncement, listAnnouncementFeed, listAnnouncements, listManagedAnnouncements } from "@/server/modules/announcements/service";
import { headersWith, signIn } from "../support/auth";
import { tenantOf, testDatabase } from "../support/db";
import { call } from "../support/http";

async function actorFor(key: string) {
  return (await resolveActor(headersWith((await signIn("aurora", key)).cookie)))!;
}

const draft = {
  title: "Mudança no horário do refeitório",
  summary: "O almoço passa a ser servido das 11h30 às 14h30.",
  body: "Primeiro parágrafo.\n\nSegundo parágrafo.",
  category: "institucional",
  theme: "blue",
  illustration: "calendar",
};

describe("comunicados", () => {
  beforeAll(async () => {
    await testDatabase();
  });

  it("mural mostra só o publicado e já no ar, fixados primeiro", async () => {
    const actor = await actorFor("fernando");
    const { items, total } = await listAnnouncements(actor, { limit: 50 });
    const titles = items.map((i) => i.title);
    expect(titles[0]).toBe("Nova política de trabalho híbrido");
    expect(titles).not.toContain("Festa de fim de ano"); // agendado
    expect(titles).not.toContain("Resultado da campanha do agasalho"); // arquivado
    expect(titles.some((t) => t.includes("rascunho"))).toBe(false);
    expect(total).toBe(items.length);

    const filtered = await listAnnouncements(actor, { category: "seguranca", limit: 10 });
    expect(filtered.items.map((i) => i.title)).toEqual(["Simulado de evacuação do prédio"]);

    const { db } = await testDatabase();
    const tenant = await tenantOf("aurora");
    const [scheduled] = await db.select({ id: s.announcements.id }).from(s.announcements).where(and(eq(s.announcements.tenantId, tenant.tenantId), eq(s.announcements.title, "Festa de fim de ano")));
    await expect(getAnnouncement(actor, scheduled!.id)).rejects.toMatchObject({ status: 404 });
  });

  it("editor cria rascunho, publica, agenda e arquiva — com auditoria", async () => {
    const { cookie } = await signIn("aurora", "rafael");
    const reader = await actorFor("fernando");

    const created = await call(createRoute.POST, { path: "/api/v1/announcements", method: "POST", cookie, body: draft });
    expect(created.status).toBe(200);
    const id = created.json.id as string;
    await expect(getAnnouncement(reader, id)).rejects.toMatchObject({ status: 404 });

    const published = await call(publishRoute.POST, { path: "/x", method: "POST", cookie, params: { id }, body: {} });
    expect(published.json).toMatchObject({ status: "published" });
    expect((await getAnnouncement(reader, id)).body).toContain("Segundo parágrafo");
    expect((await listAnnouncementFeed(reader, 10)).map((a) => a.id)).toContain(id);

    const archived = await call(archiveRoute.POST, { path: "/x", method: "POST", cookie, params: { id } });
    expect(archived.status).toBe(200);
    await expect(getAnnouncement(reader, id)).rejects.toMatchObject({ status: 404 });
    expect((await call(itemRoute.DELETE, { path: "/x", method: "DELETE", cookie, params: { id } })).status).toBe(409);

    const later = await call(createRoute.POST, { path: "/api/v1/announcements", method: "POST", cookie, body: { ...draft, title: "Agendado para amanhã" } });
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const scheduled = await call(publishRoute.POST, { path: "/x", method: "POST", cookie, params: { id: later.json.id }, body: { publishAt: tomorrow } });
    expect(scheduled.json).toMatchObject({ status: "scheduled" });
    await expect(getAnnouncement(reader, later.json.id)).rejects.toMatchObject({ status: 404 });
    const managed = await listManagedAnnouncements(await actorFor("rafael"), { filter: "agendados" });
    expect(managed.items.map((m) => m.title)).toContain("Agendado para amanhã");

    const { db } = await testDatabase();
    const actions = await db.select({ action: s.auditLogs.action }).from(s.auditLogs).where(eq(s.auditLogs.resourceId, id));
    expect(actions.map((a) => a.action).sort()).toEqual(["comms.announcement_archived", "comms.announcement_created", "comms.announcement_published"]);
  });

  it("colaborador e gestor não criam nem publicam comunicados", async () => {
    for (const key of ["fernando", "carla"]) {
      const { cookie } = await signIn("aurora", key);
      expect((await call(createRoute.POST, { path: "/api/v1/announcements", method: "POST", cookie, body: draft })).status, key).toBe(403);
    }
    await expect(listManagedAnnouncements(await actorFor("fernando"), { filter: "todos" })).rejects.toMatchObject({ status: 403 });
  });

  it("validação: campos obrigatórios e agendamento fora da janela", async () => {
    const { cookie } = await signIn("aurora", "rafael");
    const invalid = await call(createRoute.POST, { path: "/api/v1/announcements", method: "POST", cookie, body: { ...draft, title: "" } });
    expect(invalid.status).toBe(400);
    const created = await call(createRoute.POST, { path: "/api/v1/announcements", method: "POST", cookie, body: draft });
    const past = await call(publishRoute.POST, { path: "/x", method: "POST", cookie, params: { id: created.json.id }, body: { publishAt: "2020-01-01T10:00:00Z" } });
    expect(past.status).toBe(400);
  });
});

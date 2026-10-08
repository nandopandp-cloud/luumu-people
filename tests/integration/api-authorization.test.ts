import { beforeAll, describe, expect, it } from "vitest";
import * as auditRoute from "@/app/api/v1/audit-logs/route";
import * as meRoute from "@/app/api/v1/me/route";
import * as profileRoute from "@/app/api/v1/me/profile/route";
import * as personRoute from "@/app/api/v1/people/[id]/route";
import * as rolesOfPersonRoute from "@/app/api/v1/people/[id]/roles/route";
import * as peopleRoute from "@/app/api/v1/people/route";
import * as rolesRoute from "@/app/api/v1/roles/route";
import { resolveActor } from "@/server/auth/session";
import { headersWith, signIn } from "../support/auth";
import { tenantOf, testDatabase, userOf } from "../support/db";
import { call } from "../support/http";

/**
 * Suíte de autorização da API (briefing, seção 51): TESTES 4 a 8, mais escopo
 * de gestor e garantias gerais (401, CSRF). Usa sessões reais e os route
 * handlers reais.
 */

type Session = Awaited<ReturnType<typeof signIn>>;

describe("autorização da API", () => {
  let fernando: Session; // Colaborador
  let rafael: Session; // Editor
  let carla: Session; // Gestora (Produto)
  let juliana: Session; // G&G
  let paula: Session; // Administradora

  beforeAll(async () => {
    await testDatabase();
    [fernando, rafael, carla, juliana, paula] = await Promise.all([
      signIn("aurora", "fernando"),
      signIn("aurora", "rafael"),
      signIn("aurora", "carla"),
      signIn("aurora", "juliana"),
      signIn("aurora", "paula"),
    ]);
  });

  it("sem sessão: 401", async () => {
    const res = await call(peopleRoute.GET, { path: "/api/v1/people" });
    expect(res.status).toBe(401);
    expect(res.json.title).toBe("Sessão expirada");
  });

  describe("TESTE 6 — colaborador tenta acessar endpoints administrativos", () => {
    it.each([
      ["diretório de pessoas", peopleRoute.GET, "/api/v1/people"],
      ["auditoria", auditRoute.GET, "/api/v1/audit-logs"],
      ["papéis", rolesRoute.GET, "/api/v1/roles"],
    ])("%s → 403", async (_label, handler, path) => {
      const res = await call(handler, { path, cookie: fernando.cookie });
      expect(res.status).toBe(403);
    });

    it("mas acessa os próprios dados", async () => {
      const res = await call(profileRoute.GET, { path: "/api/v1/me/profile", cookie: fernando.cookie });
      expect(res.status).toBe(200);
      expect(res.json.name).toBe("Fernando Santos");
      expect(res.json.managerName).toBe("Carla Mendes");
    });
  });

  describe("TESTE 5 — editor tenta acessar dados sensíveis de G&G", () => {
    it("diretório de pessoas → 403", async () => {
      expect((await call(peopleRoute.GET, { path: "/api/v1/people", cookie: rafael.cookie })).status).toBe(403);
    });
    it("dados de uma pessoa → 403", async () => {
      const ana = await userOf("aurora", "fernando");
      expect((await call(personRoute.GET, { path: `/api/v1/people/${ana.id}`, cookie: rafael.cookie, params: { id: ana.id } })).status).toBe(403);
    });
    it("auditoria → 403", async () => {
      expect((await call(auditRoute.GET, { path: "/api/v1/audit-logs", cookie: rafael.cookie })).status).toBe(403);
    });
  });

  describe("TESTE 4 — usuário da empresa A tenta acessar recurso da empresa B", () => {
    it("G&G da Aurora não vê pessoa da Horizonte (404, sem revelar existência)", async () => {
      const sergio = await userOf("horizonte", "sergio");
      const res = await call(personRoute.GET, { path: `/api/v1/people/${sergio.id}`, cookie: juliana.cookie, params: { id: sergio.id } });
      expect(res.status).toBe(404);
    });

    it("a listagem nunca contém pessoas de outro tenant", async () => {
      const horizonte = await tenantOf("horizonte");
      const res = await call(peopleRoute.GET, { path: "/api/v1/people?limit=100", cookie: juliana.cookie });
      expect(res.status).toBe(200);
      const foreignIds = new Set([...horizonte.users.values()].map((u) => u.id));
      expect(res.json.items.some((p: { id: string }) => foreignIds.has(p.id))).toBe(false);
      expect(res.json.items.length).toBe((await tenantOf("aurora")).users.size);
    });

    it("administrador da Aurora não concede papel a pessoa da Horizonte", async () => {
      const igor = await userOf("horizonte", "igor");
      const roles = await call(rolesRoute.GET, { path: "/api/v1/roles", cookie: paula.cookie });
      const editor = roles.json.find((r: { key: string }) => r.key === "editor");
      const res = await call(rolesOfPersonRoute.POST, {
        path: `/api/v1/people/${igor.id}/roles`,
        method: "POST",
        cookie: paula.cookie,
        params: { id: igor.id },
        body: { roleId: editor.id, scopeType: "TENANT" },
      });
      expect(res.status).toBe(404);
    });
  });

  describe("TESTE 7 — usuário tenta alterar o próprio papel via API", () => {
    it("campo role no perfil é rejeitado (schema estrito)", async () => {
      const res = await call(profileRoute.PATCH, { path: "/api/v1/me/profile", method: "PATCH", cookie: fernando.cookie, body: { role: "admin" } });
      expect(res.status).toBe(400);
    });

    it("colaborador não acessa o endpoint de papéis", async () => {
      const res = await call(rolesOfPersonRoute.POST, {
        path: `/api/v1/people/${fernando.userId}/roles`,
        method: "POST",
        cookie: fernando.cookie,
        params: { id: fernando.userId },
        body: { roleId: "00000000-0000-4000-8000-000000000000", scopeType: "TENANT" },
      });
      expect(res.status).toBe(403);
    });

    it("nem o administrador altera os próprios papéis", async () => {
      const roles = await call(rolesRoute.GET, { path: "/api/v1/roles", cookie: paula.cookie });
      const manager = roles.json.find((r: { key: string }) => r.key === "manager");
      const res = await call(rolesOfPersonRoute.POST, {
        path: `/api/v1/people/${paula.userId}/roles`,
        method: "POST",
        cookie: paula.cookie,
        params: { id: paula.userId },
        body: { roleId: manager.id, scopeType: "TEAM_TREE" },
      });
      expect(res.status).toBe(403);
      expect(res.json.detail).toMatch(/seus próprios papéis/);
    });
  });

  describe("TESTE 8 — manipulação de tenant_id no request", () => {
    it("tenant_id na query é ignorado: resultados continuam do tenant da sessão", async () => {
      const horizonte = await tenantOf("horizonte");
      const res = await call(peopleRoute.GET, { path: `/api/v1/people?tenant_id=${horizonte.tenantId}&limit=100`, cookie: juliana.cookie });
      expect(res.status).toBe(200);
      const foreignIds = new Set([...horizonte.users.values()].map((u) => u.id));
      expect(res.json.items.some((p: { id: string }) => foreignIds.has(p.id))).toBe(false);
    });

    it("tenantId no corpo é descartado antes da validação", async () => {
      const horizonte = await tenantOf("horizonte");
      const res = await call(profileRoute.PATCH, {
        path: "/api/v1/me/profile",
        method: "PATCH",
        cookie: fernando.cookie,
        body: { headline: "Aprendendo todos os dias.", tenantId: horizonte.tenantId },
      });
      expect(res.status).toBe(200);
      expect(res.json.headline).toBe("Aprendendo todos os dias.");
      const me = await call(meRoute.GET, { path: "/api/v1/me", cookie: fernando.cookie });
      expect(me.json.organization.slug).toBe("aurora");
    });
  });

  describe("escopo do gestor", () => {
    it("gestora lista apenas a própria equipe", async () => {
      const res = await call(peopleRoute.GET, { path: "/api/v1/people?limit=100", cookie: carla.cookie });
      expect(res.status).toBe(200);
      const names = res.json.items.map((p: { name: string }) => p.name).sort();
      expect(names).toEqual(["Camila Oliveira", "Fernando Santos", "Gabriel Rocha", "Helena Duarte", "Lucas Ferreira"]);
    });

    it("gestora não vê pessoa de outra equipe (404)", async () => {
      const joao = await userOf("aurora", "joao");
      expect((await call(personRoute.GET, { path: `/api/v1/people/${joao.id}`, cookie: carla.cookie, params: { id: joao.id } })).status).toBe(404);
    });

    it("gestora não recebe dados pessoais (telefone, contrato) da equipe", async () => {
      const res = await call(personRoute.GET, { path: `/api/v1/people/${fernando.userId}`, cookie: carla.cookie, params: { id: fernando.userId } });
      expect(res.status).toBe(200);
      expect(res.json.personal).toBeNull();
    });

    it("G&G recebe dados pessoais", async () => {
      const res = await call(personRoute.GET, { path: `/api/v1/people/${fernando.userId}`, cookie: juliana.cookie, params: { id: fernando.userId } });
      expect(res.json.personal?.contractType).toBe("clt");
    });
  });

  describe("concessão de papel pelo administrador", () => {
    it("concede, audita e encerra as sessões do usuário afetado", async () => {
      const target = await signIn("aurora", "gabriel");
      const roles = await call(rolesRoute.GET, { path: "/api/v1/roles", cookie: paula.cookie });
      const editor = roles.json.find((r: { key: string }) => r.key === "editor");

      const res = await call(rolesOfPersonRoute.POST, {
        path: `/api/v1/people/${target.userId}/roles`,
        method: "POST",
        cookie: paula.cookie,
        params: { id: target.userId },
        body: { roleId: editor.id, scopeType: "TENANT" },
      });
      expect(res.status).toBe(201);
      expect(await resolveActor(headersWith(target.cookie))).toBeNull();

      const audit = await call(auditRoute.GET, { path: "/api/v1/audit-logs?action=access.role_granted", cookie: paula.cookie });
      expect(audit.json.items[0]).toMatchObject({ action: "access.role_granted", resourceId: target.userId, actorName: "Paula Ribeiro" });
    });
  });

  describe("CSRF", () => {
    it("mutação vinda de outra origem é rejeitada", async () => {
      const res = await call(profileRoute.PATCH, {
        path: "/api/v1/me/profile",
        method: "PATCH",
        cookie: fernando.cookie,
        body: { headline: "x" },
        headers: { origin: "https://site-malicioso.example", "sec-fetch-site": "cross-site" },
      });
      expect(res.status).toBe(403);
    });
  });
});

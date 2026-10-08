import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, PERMISSIONS, type Permission, type Scope } from "./permissions";
import { can, canGrantRole, hasPermissionAnywhere, type Actor, type Grant, type ScopeResolver } from "./policy";
import { SYSTEM_ROLES } from "./system-roles";

// Organograma fictício:
//   carla (gestora) → fernando → ana
//   carla           → bruno
//   área Produto (prod) ⊃ subárea Growth (growth); joão em Tecnologia (tech)
const reportsTo: Record<string, string> = { fernando: "carla", ana: "fernando", bruno: "carla" };
const orgUnitOf: Record<string, string> = { fernando: "prod", ana: "growth", bruno: "prod", joao: "tech" };
const orgParent: Record<string, string | undefined> = { growth: "prod", prod: undefined, tech: undefined };

const resolver: ScopeResolver = {
  async isDirectReport(managerId, userId) {
    return reportsTo[userId] === managerId;
  },
  async isInTeamTree(managerId, userId) {
    let current = reportsTo[userId];
    while (current) {
      if (current === managerId) return true;
      current = reportsTo[current];
    }
    return false;
  },
  async isOrgUnitInTree(root, unit) {
    let current: string | undefined = unit;
    while (current) {
      if (current === root) return true;
      current = orgParent[current];
    }
    return false;
  },
  async isUserInOrgUnitTree(root, userId) {
    const unit = orgUnitOf[userId];
    return unit ? this.isOrgUnitInTree(root, unit) : false;
  },
};

function grant(roleKey: string, permissions: readonly Permission[], scope: Scope, scopeOrgUnitId: string | null = null): Grant {
  return { roleId: `role-${roleKey}`, roleKey, permissions: new Set(permissions), scope, scopeOrgUnitId };
}

function systemGrant(key: string, scope?: Scope, scopeOrgUnitId: string | null = null): Grant {
  const role = SYSTEM_ROLES.find((r) => r.key === key);
  if (!role) throw new Error(key);
  return grant(key, role.permissions, scope ?? role.defaultScope, scopeOrgUnitId);
}

const actor = (userId: string, grants: Grant[]): Actor => ({ userId, tenantId: "t1", grants });

describe("catálogo de permissões", () => {
  it("não contém nenhuma capacidade de leitura de resposta individual anônima", () => {
    const forbidden = ALL_PERMISSIONS.filter((p) => /anonym|individual|raw|response/i.test(p) && p !== "survey.identified.read");
    expect(forbidden).toEqual([]);
  });

  it("todo papel de sistema usa apenas permissões do catálogo", () => {
    for (const role of SYSTEM_ROLES) {
      for (const p of role.permissions) expect(Object.hasOwn(PERMISSIONS, p)).toBe(true);
    }
  });

  it("Editor não possui permissões de dados de pessoas, pesquisas ou relatórios", () => {
    const editor = SYSTEM_ROLES.find((r) => r.key === "editor")!;
    const leaked = editor.permissions.filter((p) => /^(people|survey|reports|development|learning|access|tenant|audit)\./.test(p));
    expect(leaked).toEqual([]);
  });

  it("Colaborador não possui nenhuma permissão administrativa", () => {
    expect(SYSTEM_ROLES.find((r) => r.key === "employee")!.permissions).toEqual([]);
  });
});

describe("can() — escopos", () => {
  const carla = actor("carla", [systemGrant("manager")]);

  it("gestor (TEAM_TREE) acessa a própria árvore", async () => {
    expect(await can(carla, "development.read", { kind: "user", userId: "fernando" }, resolver)).toBe(true);
    expect(await can(carla, "development.read", { kind: "user", userId: "ana" }, resolver)).toBe(true);
  });

  it("gestor não acessa pessoas fora da equipe", async () => {
    expect(await can(carla, "development.read", { kind: "user", userId: "joao" }, resolver)).toBe(false);
  });

  it("gestor não acessa recursos de toda a empresa", async () => {
    expect(await can(carla, "reports.read", { kind: "tenant" }, resolver)).toBe(false);
  });

  it("TEAM_DIRECT não alcança subordinados indiretos", async () => {
    const direct = actor("carla", [systemGrant("manager", "TEAM_DIRECT")]);
    expect(await can(direct, "development.read", { kind: "user", userId: "fernando" }, resolver)).toBe(true);
    expect(await can(direct, "development.read", { kind: "user", userId: "ana" }, resolver)).toBe(false);
  });

  it("ORG_UNIT_TREE cobre subáreas e somente elas", async () => {
    const hr = actor("rh", [systemGrant("people", "ORG_UNIT_TREE", "prod")]);
    expect(await can(hr, "people.directory.read", { kind: "user", userId: "ana" }, resolver)).toBe(true);
    expect(await can(hr, "people.directory.read", { kind: "orgUnit", orgUnitId: "growth" }, resolver)).toBe(true);
    expect(await can(hr, "people.directory.read", { kind: "user", userId: "joao" }, resolver)).toBe(false);
    expect(await can(hr, "people.directory.read", { kind: "tenant" }, resolver)).toBe(false);
  });

  it("sem a permissão, nenhum escopo concede acesso", async () => {
    const editor = actor("ed", [systemGrant("editor")]);
    expect(await can(editor, "people.directory.read", { kind: "user", userId: "ana" }, resolver)).toBe(false);
    expect(await can(editor, "survey.results.read_aggregate", { kind: "tenant" }, resolver)).toBe(false);
  });

  it("colaborador sem papéis de gestão não tem acesso ao ambiente de gestão", () => {
    expect(hasPermissionAnywhere(actor("ana", [systemGrant("employee")]), "management.access")).toBe(false);
  });
});

describe("canGrantRole() — TESTE 7: escalonamento de privilégio", () => {
  const admin = actor("admin", [systemGrant("admin")]);
  const people = actor("gg", [systemGrant("people")]);
  const adminRole = SYSTEM_ROLES.find((r) => r.key === "admin")!;
  const editorRole = SYSTEM_ROLES.find((r) => r.key === "editor")!;

  it("ninguém altera os próprios papéis", () => {
    expect(canGrantRole(admin, { targetUserId: "admin", rolePermissions: adminRole.permissions, scope: "TENANT", scopeOrgUnitId: null })).toEqual({
      ok: false,
      reason: "self_assignment",
    });
  });

  it("sem access.roles.assign não concede nada", () => {
    expect(canGrantRole(people, { targetUserId: "ana", rolePermissions: [], scope: "SELF", scopeOrgUnitId: null })).toEqual({
      ok: false,
      reason: "missing_assign_permission",
    });
  });

  it("não concede papel com permissões que o ator não possui", () => {
    const limitedAdmin = actor("la", [grant("custom", ["access.roles.assign", ...editorRole.permissions], "TENANT")]);
    expect(canGrantRole(limitedAdmin, { targetUserId: "ana", rolePermissions: adminRole.permissions, scope: "TENANT", scopeOrgUnitId: null })).toEqual({
      ok: false,
      reason: "privilege_escalation",
    });
    expect(canGrantRole(limitedAdmin, { targetUserId: "ana", rolePermissions: editorRole.permissions, scope: "TENANT", scopeOrgUnitId: null })).toEqual({ ok: true });
  });

  it("não concede escopo mais amplo que o próprio", () => {
    const teamAssigner = actor("x", [grant("a", ["access.roles.assign"], "TENANT"), grant("m", ["development.read"], "TEAM_TREE")]);
    expect(canGrantRole(teamAssigner, { targetUserId: "ana", rolePermissions: ["development.read"], scope: "TENANT", scopeOrgUnitId: null }).ok).toBe(false);
    expect(canGrantRole(teamAssigner, { targetUserId: "ana", rolePermissions: ["development.read"], scope: "TEAM_DIRECT", scopeOrgUnitId: null }).ok).toBe(true);
  });

  it("administrador concede papéis a terceiros", () => {
    expect(canGrantRole(admin, { targetUserId: "ana", rolePermissions: adminRole.permissions, scope: "TENANT", scopeOrgUnitId: null })).toEqual({ ok: true });
  });
});

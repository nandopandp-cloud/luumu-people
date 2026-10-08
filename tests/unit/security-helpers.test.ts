import { describe, expect, it } from "vitest";
import { sanitizeMetadata } from "@/server/audit/audit";
import { checkRateLimit } from "@/server/http/rate-limit";
import { stripTenantKeys } from "@/server/http/route";
import { evaluateFlags } from "@/server/modules/flags/service";
import { safeNext } from "@/features/auth/safe-redirect";

describe("stripTenantKeys — TESTE 8 (camada HTTP)", () => {
  it("remove tenant_id/tenantId em qualquer nível", () => {
    expect(stripTenantKeys({ tenantId: "x", a: { tenant_id: "y", b: [{ tenant: "z", c: 1 }] } })).toEqual({ a: { b: [{ c: 1 }] } });
  });
  it("preserva valores primitivos", () => {
    expect(stripTenantKeys("tenantId")).toBe("tenantId");
  });
});

describe("safeNext — redirecionamento após login", () => {
  it.each(["https://malicioso.example", "//malicioso.example", "/\\\\malicioso.example", "/api/v1/me", "/entrar"])("rejeita %s", (value) => {
    expect(safeNext(value)).toBe("/inicio");
  });
  it("aceita caminhos internos", () => {
    expect(safeNext("/gestao/usuarios?q=ana")).toBe("/gestao/usuarios?q=ana");
  });
});

describe("sanitizeMetadata — auditoria sem dados sensíveis", () => {
  it("remove chaves de senha, token e respostas", () => {
    expect(sanitizeMetadata({ role: "admin", password: "x", accessToken: "t", answers: [1], surveyResponse: {} })).toEqual({ role: "admin" });
  });
});

describe("rate limit", () => {
  it("bloqueia acima do limite e libera na próxima janela", () => {
    const rule = { limit: 2, windowMs: 1000 };
    const key = `teste-${Math.random()}`;
    expect(checkRateLimit(key, rule, 0).allowed).toBe(true);
    expect(checkRateLimit(key, rule, 10).allowed).toBe(true);
    const blocked = checkRateLimit(key, rule, 20);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(1);
    expect(checkRateLimit(key, rule, 1001).allowed).toBe(true);
  });
});

describe("feature flags — precedência", () => {
  const flags = [{ key: "gamification", defaultEnabled: true }];
  const ctx = { tenantId: "t1", userId: "u1", roleIds: ["r1", "r2"] };
  const o = (partial: Partial<{ tenantId: string | null; roleId: string | null; userId: string | null; enabled: boolean }>) => ({
    flagKey: "gamification",
    tenantId: null,
    roleId: null,
    userId: null,
    enabled: true,
    ...partial,
  });

  it("usa o padrão sem sobrescritas", () => {
    expect(evaluateFlags(flags, [], ctx)).toEqual({ gamification: true });
  });
  it("usuário > papel > tenant > global", () => {
    const overrides = [o({ enabled: false }), o({ tenantId: "t1", enabled: true }), o({ tenantId: "t1", roleId: "r1", enabled: false }), o({ tenantId: "t1", userId: "u1", enabled: true })];
    expect(evaluateFlags(flags, overrides, ctx).gamification).toBe(true);
    expect(evaluateFlags(flags, overrides.slice(0, 3), ctx).gamification).toBe(false);
    expect(evaluateFlags(flags, overrides.slice(0, 2), ctx).gamification).toBe(true);
    expect(evaluateFlags(flags, overrides.slice(0, 1), ctx).gamification).toBe(false);
  });
  it("papéis conflitantes: desligado vence (fail closed)", () => {
    const overrides = [o({ tenantId: "t1", roleId: "r1", enabled: true }), o({ tenantId: "t1", roleId: "r2", enabled: false })];
    expect(evaluateFlags(flags, overrides, ctx).gamification).toBe(false);
  });
  it("sobrescritas de outro tenant são ignoradas", () => {
    expect(evaluateFlags(flags, [o({ tenantId: "t2", enabled: false })], ctx).gamification).toBe(true);
  });
});

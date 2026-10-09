import { describe, expect, it } from "vitest";
import { sanitizeMetadata } from "@/server/audit/audit";
import { checkRateLimit, memoryStore, setRateLimitStore } from "@/server/http/rate-limit";
import { stripTenantKeys } from "@/server/http/route";
import { evaluateFlags } from "@/server/modules/flags/service";
import { safeNext } from "@/features/auth/safe-redirect";
import { env, resetEnvCache } from "@/server/env";

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

describe("rate limit (regra de janela fixa)", () => {
  it("bloqueia acima do limite e libera na próxima janela", async () => {
    let clock = 0;
    setRateLimitStore(memoryStore(() => clock));
    const ctx = { tenantId: "00000000-0000-4000-8000-000000000001", userId: null };
    const rule = { limit: 2, windowMs: 1000 };
    const key = `teste-${Math.random()}`;
    expect((await checkRateLimit(ctx, key, rule, clock)).allowed).toBe(true);
    clock = 10;
    expect((await checkRateLimit(ctx, key, rule, clock)).allowed).toBe(true);
    clock = 20;
    const blocked = await checkRateLimit(ctx, key, rule, clock);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(1);
    clock = 1001;
    expect((await checkRateLimit(ctx, key, rule, clock)).allowed).toBe(true);
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

describe("env — login com Google", () => {
  function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
    const saved = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
    Object.assign(process.env, vars);
    for (const [k, v] of Object.entries(vars)) if (v === undefined) delete process.env[k];
    resetEnvCache();
    try {
      fn();
    } finally {
      for (const [k, v] of Object.entries(saved)) if (v === undefined) delete process.env[k];
      else process.env[k] = v;
      resetEnvCache();
    }
  }

  it("valores vazios (copiados do .env.example) contam como não configurado", () => {
    withEnv({ GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "" }, () => {
      expect(env().GOOGLE_CLIENT_ID).toBeUndefined();
    });
  });

  it("exige client ID e secret juntos", () => {
    withEnv({ GOOGLE_CLIENT_ID: "id.apps.googleusercontent.com", GOOGLE_CLIENT_SECRET: "" }, () => {
      expect(() => env()).toThrow(/GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET juntos/);
    });
  });
});

import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { resolveActor, type AuthenticatedActor } from "@/server/auth/session";
import type { Permission } from "@/server/authz/permissions";
import { hasPermissionAnywhere } from "@/server/authz/policy";
import { trustedOrigins } from "@/server/env";
import { logger } from "@/server/observability/logger";
import { badRequest, forbidden, HttpError, problem, unauthorized } from "./errors";
import { checkRateLimit, DEFAULT_RATE_LIMIT, type RateLimitRule } from "./rate-limit";

/**
 * Wrapper único para route handlers da API (/api/v1). Toda rota declara:
 *  - `permission`: permissão exigida (em algum escopo), ou `"authenticated"`
 *    para rotas sobre os próprios dados. Não existe rota sem declaração.
 *    A checagem de ESCOPO sobre o recurso específico é feita no serviço (can()).
 *  - `query`/`body`/`params`: schemas Zod (objetos estritos).
 *
 * Garantias:
 *  - 401 sem sessão; 403 sem permissão;
 *  - mutações exigem mesma origem (Origin/Sec-Fetch-Site) — proteção CSRF;
 *  - qualquer `tenant_id`/`tenantId` enviado pelo cliente é descartado antes
 *    da validação: o tenant vem exclusivamente da sessão;
 *  - corpo limitado a MAX_BODY_BYTES; rate limit por usuário;
 *  - erros inesperados viram 500 genérico, com requestId para correlação.
 */

const MAX_BODY_BYTES = 64 * 1024;
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const TENANT_KEYS = new Set(["tenant_id", "tenantId", "tenant"]);

type Schema = z.ZodType;
type Infer<S> = S extends z.ZodType ? z.infer<S> : undefined;

export type RouteContext<Q, B, P> = {
  actor: AuthenticatedActor;
  query: Q;
  body: B;
  params: P;
  request: Request;
  requestId: string;
  meta: { ip: string | null; userAgent: string | null; requestId: string };
};

type RouteConfig<QS, BS, PS> = {
  permission: Permission | "authenticated";
  query?: QS;
  body?: BS;
  params?: PS;
  rateLimit?: RateLimitRule;
  handler: (ctx: RouteContext<Infer<QS>, Infer<BS>, Infer<PS>>) => Promise<unknown>;
};

/** Remove recursivamente qualquer chave de tenant vinda do cliente. */
export function stripTenantKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripTenantKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !TENANT_KEYS.has(key))
        .map(([key, v]) => [key, stripTenantKeys(v)]),
    );
  }
  return value;
}

function isSameOrigin(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return false;
  const origin = request.headers.get("origin");
  if (!origin) return fetchSite === "same-origin";
  try {
    const normalized = new URL(origin).origin;
    return normalized === new URL(request.url).origin || trustedOrigins().includes(normalized);
  } catch {
    return false;
  }
}

async function readJson(request: Request): Promise<unknown> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_BODY_BYTES) throw new HttpError(413, "Conteúdo muito grande");
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new HttpError(413, "Conteúdo muito grande");
  if (!text) return {};
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
    throw new HttpError(415, "Formato não suportado", "Envie os dados como JSON.");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw badRequest("O corpo da requisição não é um JSON válido.");
  }
}

function parse<S extends Schema | undefined>(schema: S, input: unknown, where: string): Infer<S> {
  if (!schema) return undefined as Infer<S>;
  const result = schema.safeParse(stripTenantKeys(input));
  if (!result.success) {
    throw badRequest(`Alguns dados de ${where} são inválidos.`, {
      errors: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  return result.data as Infer<S>;
}

export function defineRoute<QS extends Schema | undefined = undefined, BS extends Schema | undefined = undefined, PS extends Schema | undefined = undefined>(
  config: RouteConfig<QS, BS, PS>,
) {
  return async (request: Request, segment?: { params?: Promise<Record<string, string | string[]>> }): Promise<Response> => {
    const requestId = request.headers.get("x-request-id")?.slice(0, 64) || randomUUID();
    const meta = {
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: request.headers.get("user-agent"),
      requestId,
    };
    try {
      if (MUTATING.has(request.method) && !isSameOrigin(request)) {
        throw forbidden("Origem da requisição não permitida.");
      }

      const actor = await resolveActor(request.headers);
      if (!actor) throw unauthorized();

      if (config.permission !== "authenticated" && !hasPermissionAnywhere(actor, config.permission)) {
        throw forbidden();
      }

      const limit = checkRateLimit(`api:${actor.userId}`, config.rateLimit ?? DEFAULT_RATE_LIMIT);
      if (!limit.allowed) {
        return problem(429, "Muitas requisições", "Aguarde um instante e tente novamente.", undefined, {
          "retry-after": String(limit.retryAfterSeconds),
        });
      }

      const url = new URL(request.url);
      const query = parse(config.query, Object.fromEntries(url.searchParams), "consulta");
      const params = parse(config.params, (await segment?.params) ?? {}, "endereço");
      const body = parse(config.body, MUTATING.has(request.method) ? await readJson(request) : {}, "envio");

      const result = await config.handler({ actor, query, body, params, request, requestId, meta } as RouteContext<Infer<QS>, Infer<BS>, Infer<PS>>);
      if (result instanceof Response) return result;
      if (result === undefined) return new Response(null, { status: 204, headers: { "x-request-id": requestId } });
      return Response.json(result, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
    } catch (error) {
      if (error instanceof HttpError) {
        return problem(error.status, error.title, error.detail, { ...error.extra, requestId });
      }
      logger().error({ err: error, requestId, path: new URL(request.url).pathname }, "erro inesperado na API");
      return problem(500, "Algo deu errado", "Tente novamente em instantes. Se persistir, informe o código ao suporte.", { requestId });
    }
  };
}

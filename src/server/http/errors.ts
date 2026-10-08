import "server-only";

/**
 * Erros de domínio → respostas HTTP padronizadas (RFC 9457, application/problem+json).
 * Mensagens em linguagem humana; nenhum detalhe interno (stack, SQL) chega ao cliente.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly title: string,
    readonly detail?: string,
    readonly extra?: Record<string, unknown>,
  ) {
    super(title);
  }
}

export const unauthorized = () => new HttpError(401, "Sessão expirada", "Entre novamente para continuar.");

export const forbidden = (detail = "Você não tem permissão para acessar este recurso.") => new HttpError(403, "Acesso negado", detail);

/** Para recursos fora do escopo do ator, preferimos 404 a 403: não revela existência. */
export const notFound = (detail = "Não encontramos o que você procurou.") => new HttpError(404, "Não encontrado", detail);

export const conflict = (detail: string) => new HttpError(409, "Conflito", detail);

export const badRequest = (detail: string, extra?: Record<string, unknown>) => new HttpError(400, "Requisição inválida", detail, extra);

export function problem(status: number, title: string, detail?: string, extra?: Record<string, unknown>, headers?: HeadersInit): Response {
  return new Response(JSON.stringify({ type: "about:blank", status, title, detail, ...extra }), {
    status,
    headers: { "content-type": "application/problem+json; charset=utf-8", "cache-control": "no-store", ...Object.fromEntries(new Headers(headers)) },
  });
}

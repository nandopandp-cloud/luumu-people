type Handler = (request: Request, segment?: { params?: Promise<Record<string, string | string[]>> }) => Promise<Response>;

const ORIGIN = "http://localhost:3000";

/** Chama um route handler real, como o Next faria, com cookie de sessão e mesma origem. */
export async function call(
  handler: Handler,
  options: { path: string; method?: string; cookie?: string; body?: unknown; params?: Record<string, string>; headers?: Record<string, string> },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- testes inspecionam JSON arbitrário
): Promise<{ status: number; json: any }> {
  const method = options.method ?? "GET";
  const headers = new Headers({ "x-forwarded-for": "203.0.113.20", ...options.headers });
  if (options.cookie) headers.set("cookie", options.cookie);
  if (method !== "GET" && !options.headers?.origin && !("origin" in (options.headers ?? {}))) {
    headers.set("origin", ORIGIN);
    headers.set("sec-fetch-site", "same-origin");
  }
  let body: string | undefined;
  if (options.body !== undefined) {
    body = JSON.stringify(options.body);
    headers.set("content-type", "application/json");
  }
  const response = await handler(new Request(`${ORIGIN}${options.path}`, { method, headers, body }), {
    params: Promise.resolve(options.params ?? {}),
  });
  const text = await response.text();
  return { status: response.status, json: text ? JSON.parse(text) : null };
}

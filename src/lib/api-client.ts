"use client";

/** Erro de API no formato problem+json, com mensagem pronta para exibição. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fieldErrors: { path: string; message: string }[] = [],
  ) {
    super(message);
  }
}

/** Chamada à API da própria aplicação (mesma origem; o cookie de sessão vai junto). */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: init.method ?? "GET",
      headers: init.body !== undefined ? { "content-type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(0, "Sem conexão. Verifique sua internet e tente novamente.");
  }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, data?.detail ?? data?.title ?? "Algo deu errado. Tente novamente.", data?.errors ?? []);
  }
  return data as T;
}

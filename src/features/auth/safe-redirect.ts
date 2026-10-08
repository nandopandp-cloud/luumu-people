/** Aceita apenas caminhos internos (evita open redirect: "//site", "https://…"). */
export function safeNext(value: string | null | undefined, fallback = "/inicio"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.startsWith("/api") || value.startsWith("/entrar")) return fallback;
  return value;
}

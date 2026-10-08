/** Verificação de disponibilidade. Não toca no banco nem expõe versão/ambiente. */
export function GET() {
  return Response.json({ status: "ok" }, { headers: { "cache-control": "no-store" } });
}

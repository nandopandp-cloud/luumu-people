/** Data ISO (yyyy-mm-dd) → dd/mm/aaaa, sem conversão de fuso horário. */
export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : "—";
}

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export function formatDateTime(value: Date | string): string {
  return dateTime.format(new Date(value));
}

export function formatLocation(city: string | null | undefined, state: string | null | undefined): string {
  if (!city) return "—";
  return state && state !== "BR" ? `${city} - ${state}` : city;
}

export const CONTRACT_LABELS: Record<string, string> = {
  clt: "CLT",
  pj: "PJ",
  intern: "Estágio",
  apprentice: "Jovem aprendiz",
  temporary: "Temporário",
};

/** "Bom dia" (5h–12h), "Boa tarde" (12h–18h) ou "Boa noite", no horário de Brasília. */
export function greetingNow(now = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hourCycle: "h23", timeZone: "America/Sao_Paulo" }).format(now));
  return hour >= 5 && hour < 12 ? "Bom dia" : hour >= 12 && hour < 18 ? "Boa tarde" : "Boa noite";
}

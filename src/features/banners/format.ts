/**
 * Datas de agendamento dos banners no horário de Brasília (UTC−03:00, sem
 * horário de verão desde 2019), independentemente do fuso do servidor.
 */
const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** Data → valor de <input type="datetime-local"> (horário de Brasília). */
export function toLocalInput(date: Date | string | null) {
  if (!date) return "";
  const p = Object.fromEntries(parts.formatToParts(new Date(date)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** Valor de <input type="datetime-local"> (horário de Brasília) → ISO com fuso. */
export function fromLocalInput(value: string) {
  return value ? `${value}:00-03:00` : null;
}

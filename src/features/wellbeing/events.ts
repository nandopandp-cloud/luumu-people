/** Abre o modal "Como você está se sentindo hoje?" de qualquer ponto da interface. */
export const OPEN_MOOD = "luumu:open-mood";

export function openMoodDialog() {
  window.dispatchEvent(new Event(OPEN_MOOD));
}

/** Registro de hoje como chega ao cliente (datas em ISO). */
export type TodayMoodView = { mood: number | null; note: string | null; at: string | null; dismissed: boolean };

/** "09:12", no horário de Brasília (igual no servidor e no navegador). */
export const moodTime = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(iso));

/** Converte o registro do servidor para o cliente. */
export function toMoodView(today: { mood: number | null; note: string | null; at: Date | null; dismissed: boolean }): TodayMoodView {
  return { mood: today.mood, note: today.note, at: today.at?.toISOString() ?? null, dismissed: today.dismissed };
}

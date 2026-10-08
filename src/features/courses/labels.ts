export const COURSE_KIND_LABEL = { course: "Curso", video: "Vídeo", quiz: "Quiz" } as const;

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${String(m).padStart(2, "0")}min` : `${h}h`;
}

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
export const monthLabel = (yyyyMm: string) => MONTHS[Number(yyyyMm.slice(5, 7)) - 1] ?? yyyyMm;

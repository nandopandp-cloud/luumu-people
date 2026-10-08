export const ANNOUNCEMENT_CATEGORY: Record<string, { label: string; tone: "purple" | "green" | "orange" | "blue" | "pink" }> = {
  institucional: { label: "Institucional", tone: "purple" },
  gente_gestao: { label: "Gente e Gestão", tone: "green" },
  desenvolvimento: { label: "Desenvolvimento", tone: "purple" },
  treinamento: { label: "Treinamento", tone: "blue" },
  evento: { label: "Evento", tone: "orange" },
  cultura: { label: "Cultura", tone: "pink" },
  seguranca: { label: "Segurança", tone: "blue" },
  bem_estar: { label: "Bem-estar", tone: "green" },
};

const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);

/** "Hoje", "Ontem", "3 dias atrás", ou a data. */
export function relativeDay(date: Date | string | null, now = new Date()): string {
  if (!date) return "";
  const d = new Date(date);
  const diff = Math.round((Date.parse(dayKey(now)) - Date.parse(dayKey(d))) / 86_400_000);
  if (diff <= 0) return "Hoje";
  if (diff === 1) return "Ontem";
  if (diff < 7) return `${diff} dias atrás`;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" }).format(d);
}

/** Dias até um prazo (aaaa-mm-dd), no fuso de Brasília. */
export function daysUntil(isoDate: string, now = new Date()): number {
  return Math.round((Date.parse(isoDate) - Date.parse(dayKey(now))) / 86_400_000);
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

export const LIBRARY_TYPE: Record<string, { label: string; card: string; iconBox: string; overline: string }> = {
  video: { label: "Vídeo", card: "bg-[#efe9fd]", iconBox: "text-purple-600", overline: "text-purple-700" },
  article: { label: "Artigo", card: "bg-[#e8f0fe]", iconBox: "text-blue-700", overline: "text-blue-700" },
  podcast: { label: "Podcast", card: "bg-[#fdeee6]", iconBox: "text-orange-600", overline: "text-orange-700" },
  quiz: { label: "Quiz", card: "bg-[#e3f6ee]", iconBox: "text-green-700", overline: "text-green-800" },
  pdf: { label: "PDF", card: "bg-[#fdebf3]", iconBox: "text-pink-700", overline: "text-pink-700" },
  template: { label: "Template", card: "bg-[#fff6d9]", iconBox: "text-yellow-700", overline: "text-yellow-700" },
  checklist: { label: "Checklist", card: "bg-[#e3f6ee]", iconBox: "text-green-700", overline: "text-green-800" },
};

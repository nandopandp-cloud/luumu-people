/** Rótulos da gestão de comunicados (seguros para Client Components). */

export const MANAGED_STATUS: Record<string, { label: string; tone: "neutral" | "blue" | "green" | "orange" }> = {
  draft: { label: "Rascunho", tone: "neutral" },
  scheduled: { label: "Agendado", tone: "blue" },
  published: { label: "Publicado", tone: "green" },
  archived: { label: "Arquivado", tone: "orange" },
};

export const THEME_LABEL: Record<string, string> = {
  purple: "Roxo",
  green: "Verde",
  orange: "Laranja",
  blue: "Azul",
  pink: "Rosa",
  yellow: "Amarelo",
};

export const ILLUSTRATION_LABEL: Record<string, string> = {
  megaphone: "Megafone",
  people: "Pessoas",
  plant: "Planta",
  shield: "Escudo",
  heart: "Coração",
  calendar: "Calendário",
  trophy: "Troféu",
  book: "Livro",
  target: "Alvo",
  lightbulb: "Lâmpada",
  chat: "Conversa",
  compass: "Bússola",
};

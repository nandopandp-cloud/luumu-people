/** Rótulos de pesquisas (compartilhados entre colaborador e gestão). */

export const SURVEY_KIND: Record<string, { label: string; tone: "purple" | "green" | "orange" | "blue" }> = {
  climate: { label: "Clima", tone: "purple" },
  enps: { label: "eNPS", tone: "blue" },
  pulse: { label: "Pulso", tone: "orange" },
  custom: { label: "Personalizada", tone: "green" },
};

/** Situação exibida na gestão ("Agendada" = lançada com início no futuro). */
export const SURVEY_STATUS: Record<"draft" | "scheduled" | "active" | "paused" | "closed", { label: string; tone: "neutral" | "orange" | "green" | "yellow" }> = {
  active: { label: "Em andamento", tone: "green" },
  scheduled: { label: "Agendada", tone: "orange" },
  paused: { label: "Pausada", tone: "yellow" },
  closed: { label: "Encerrada", tone: "neutral" },
  draft: { label: "Rascunho", tone: "neutral" },
};

export const QUESTION_TYPE_LABEL: Record<string, string> = {
  scale: "Escala de concordância (1 a 5)",
  enps: "Recomendação (0 a 10)",
  choice: "Múltipla escolha",
  text: "Texto livre",
};

export const SCALE_LABELS = ["Discordo totalmente", "Discordo", "Neutro", "Concordo", "Concordo totalmente"] as const;

export const DIMENSION_LABEL: Record<string, string> = {
  diretoria: "Diretoria",
  area: "Área",
  tempo_de_casa: "Tempo de casa",
};

/** Textos do contrato de anonimato (docs/anonymous-surveys.md) — não alterar sem revisar o contrato. */
export const ANONYMITY_COPY = {
  form: "Sua resposta é anônima. Evite inserir informações que possam identificar você ou outra pessoa.",
  suppressed: "Ainda não temos respostas suficientes para mostrar este resultado preservando o anonimato.",
} as const;

/**
 * Avisos de privacidade das pesquisas livres e identificadas (docs/anonymous-surveys.md).
 * Só o time de Gente e Gestão vê respostas e resultados.
 */
export const PRIVACY_COPY = {
  free: {
    title: "Pesquisa anônima livre",
    builder:
      "As respostas não ficam ligadas a ninguém, mas não há mínimo: os resultados aparecem desde a 1ª resposta e sem recortes por grupo. Em públicos pequenos, dá para deduzir quem respondeu o quê. Só o time de Gente e Gestão vê os resultados.",
    form: "Sua resposta é anônima: não fica ligada ao seu nome. Esta pesquisa não exige um número mínimo de respostas; se poucas pessoas responderem, ela pode ser deduzida. Os resultados são vistos só pelo time de Gente e Gestão.",
    badge: "Anônima · livre",
  },
  identified: {
    title: "Esta pesquisa é identificada",
    builder:
      "Cada resposta fica ligada ao nome de quem respondeu e é vista só pelo time de Gente e Gestão. Quem responde é avisado antes de começar. Não há mínimo de pessoas nem de respostas.",
    form: "Suas respostas ficam registradas com o seu nome e são vistas só pelo time de Gente e Gestão.",
    badge: "Identificada",
  },
} as const;

/** Data (dd/mm/aaaa) no fuso de Brasília. */
export const formatDay = (date: Date | string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" }).format(new Date(date));

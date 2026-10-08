/** Rótulos de pesquisas (compartilhados entre colaborador e gestão). */

export const SURVEY_KIND: Record<string, { label: string; tone: "purple" | "green" | "orange" | "blue" }> = {
  climate: { label: "Clima", tone: "purple" },
  enps: { label: "eNPS", tone: "green" },
  pulse: { label: "Pulso", tone: "orange" },
  custom: { label: "Personalizada", tone: "blue" },
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

/** Data (dd/mm/aaaa) no fuso de Brasília. */
export const formatDay = (date: Date | string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" }).format(new Date(date));

/**
 * Catálogo de interesses do perfil ("interesses em comum" em Conexões).
 * Compartilhado entre servidor e interface; os ícones ficam na interface
 * (src/features/connections/interest-icon.tsx). Chaves são gravadas no banco:
 * não renomear uma chave existente.
 */

export type InterestTone = "purple" | "pink" | "blue" | "green" | "orange" | "yellow";
export type Interest = { key: string; label: string; tone: InterestTone };

export const INTERESTS = [
  { key: "design", label: "Design", tone: "pink" },
  { key: "tecnologia", label: "Tecnologia", tone: "blue" },
  { key: "dados", label: "Dados e análises", tone: "blue" },
  { key: "produto", label: "Produto", tone: "purple" },
  { key: "lideranca", label: "Liderança", tone: "purple" },
  { key: "comunicacao", label: "Comunicação", tone: "orange" },
  { key: "educacao", label: "Educação", tone: "green" },
  { key: "inovacao", label: "Inovação", tone: "yellow" },
  { key: "leitura", label: "Leitura", tone: "orange" },
  { key: "escrita", label: "Escrita", tone: "purple" },
  { key: "idiomas", label: "Idiomas", tone: "blue" },
  { key: "musica", label: "Música", tone: "pink" },
  { key: "fotografia", label: "Fotografia", tone: "yellow" },
  { key: "cinema", label: "Cinema e séries", tone: "purple" },
  { key: "games", label: "Games", tone: "blue" },
  { key: "esportes", label: "Esportes", tone: "green" },
  { key: "corrida", label: "Corrida", tone: "orange" },
  { key: "ciclismo", label: "Ciclismo", tone: "green" },
  { key: "natureza", label: "Trilhas e natureza", tone: "green" },
  { key: "viagens", label: "Viagens", tone: "blue" },
  { key: "culinaria", label: "Culinária", tone: "orange" },
  { key: "cafe", label: "Café", tone: "yellow" },
  { key: "bem-estar", label: "Bem-estar", tone: "pink" },
  { key: "voluntariado", label: "Voluntariado", tone: "pink" },
  { key: "pets", label: "Pets", tone: "yellow" },
] as const satisfies readonly Interest[];

export type InterestKey = (typeof INTERESTS)[number]["key"];
export const INTEREST_KEYS = INTERESTS.map((i) => i.key) as InterestKey[];
export const MAX_INTERESTS = 12;

export function interestOf(key: string): Interest | undefined {
  return INTERESTS.find((i) => i.key === key);
}

import "server-only";
import { sql, type SQL } from "drizzle-orm";

const ACCENTS = "áàâãäåéèêëíìîïóòôõöúùûüçñ";
const PLAIN = "aaaaaaeeeeiiiiooooouuuucn";

/** Minúsculas e sem acentos (para comparar termos digitados). */
export function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Coluna "contém" o termo, ignorando acentos e caixa (parametrizado; curingas escapados). */
export function containsText(column: SQL, term: string): SQL {
  const escaped = `%${normalize(term).replace(/[%_\\]/g, "\\$&")}%`;
  return sql`translate(lower(coalesce(${column}, '')), ${ACCENTS}, ${PLAIN}) like ${escaped}`;
}

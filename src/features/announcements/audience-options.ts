import type { AudienceOption } from "./announcement-editor";

/** Ordena as áreas como árvore (diretoria → área → subárea), com a profundidade de cada uma. */
export function toAudienceOptions(units: { id: string; name: string; parentId: string | null }[]): AudienceOption[] {
  const children = new Map<string | null, typeof units>();
  for (const u of units) children.set(u.parentId, [...(children.get(u.parentId) ?? []), u]);
  const known = new Set(units.map((u) => u.id));
  const out: AudienceOption[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const u of (children.get(parentId) ?? []).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))) {
      out.push({ id: u.id, name: u.name, depth });
      walk(u.id, depth + 1);
    }
  };
  walk(null, 0);
  // Áreas cujo pai está arquivado entram na raiz.
  for (const parentId of new Set(units.flatMap((u) => (u.parentId && !known.has(u.parentId) ? [u.parentId] : [])))) walk(parentId, 0);
  return out;
}

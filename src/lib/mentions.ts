/**
 * Menções em comentários. No texto salvo, uma menção é `@[Nome](user:<uuid>)`;
 * na tela, vira "@Nome" destacado, sempre com o nome ATUAL da pessoa (o nome
 * gravado no marcador não é confiável). PURO: sem HTML, sem I/O.
 */

export type MentionPart = { type: "text"; value: string } | { type: "mention"; userId: string; name: string };

const TOKEN = /@\[([^\]\n]{1,80})\]\(user:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi;

/** Marcador de menção para um nome e id (remove caracteres que quebrariam o formato). */
export function mentionToken(name: string, userId: string): string {
  return `@[${name.replace(/[[\]()\n]/g, "").trim()}](user:${userId.toLowerCase()})`;
}

/** Divide o texto em trechos e menções. */
export function splitMentions(body: string): MentionPart[] {
  const parts: MentionPart[] = [];
  let last = 0;
  for (const m of body.matchAll(TOKEN)) {
    if (m.index > last) parts.push({ type: "text", value: body.slice(last, m.index) });
    parts.push({ type: "mention", name: m[1]!, userId: m[2]!.toLowerCase() });
    last = m.index + m[0].length;
  }
  if (last < body.length) parts.push({ type: "text", value: body.slice(last) });
  return parts;
}

/** Ids mencionados (sem repetição, na ordem). */
export function mentionedIds(body: string): string[] {
  return [...new Set(splitMentions(body).flatMap((p) => (p.type === "mention" ? [p.userId] : [])))];
}

/** Texto como aparece na tela ("@Nome"), com os nomes atuais quando conhecidos. */
export function mentionsToPlainText(body: string, names: Record<string, string> = {}): string {
  return splitMentions(body)
    .map((p) => (p.type === "text" ? p.value : `@${names[p.userId] ?? p.name}`))
    .join("");
}

/** Mantém só as menções a ids permitidos; as demais viram texto simples ("@Nome"). */
export function keepMentions(body: string, allowed: ReadonlySet<string>): string {
  return splitMentions(body)
    .map((p) => (p.type === "text" ? p.value : allowed.has(p.userId) ? mentionToken(p.name, p.userId) : `@${p.name}`))
    .join("");
}

/**
 * Converte as menções escolhidas no campo de texto ("@Nome" → marcador).
 * `picked`: nome exibido → id, só das pessoas escolhidas na lista de sugestões.
 */
export function encodeMentions(text: string, picked: ReadonlyMap<string, string>): string {
  const names = [...picked.keys()].sort((a, b) => b.length - a.length);
  if (names.length === 0) return text;
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`@(${escaped.join("|")})(?![\\p{L}\\p{N}])`, "gu");
  return text.replace(pattern, (_, name: string) => mentionToken(name, picked.get(name)!));
}

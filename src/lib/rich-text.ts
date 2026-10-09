/**
 * Formatação leve dos textos de comunicados (marcação no estilo Markdown).
 * PURO e sem HTML: o texto vira uma árvore de nós que os componentes React
 * renderizam — nada é injetado como HTML, então não há vetor de XSS.
 *
 * Blocos (separados por linha em branco):
 *   "## Título" · "### Subtítulo" · "- item" (lista) · "1. item" (lista numerada) · parágrafo
 * Inline: **negrito** · *itálico* · __sublinhado__ · [texto](https://… ou /caminho)
 * Link com outro destino (javascript:, http:, //…) fica como texto.
 */

export type Inline =
  | { type: "text"; value: string }
  | { type: "strong" | "em" | "u"; children: Inline[] }
  | { type: "link"; href: string; children: Inline[] };

export type Block =
  | { type: "p"; lines: Inline[][] }
  | { type: "h2" | "h3"; children: Inline[] }
  | { type: "ul" | "ol"; items: Inline[][] };

/** Destino de link permitido: https ou caminho interno da plataforma. */
export function isSafeHref(href: string): boolean {
  return /^https:\/\/[^\s]+$/i.test(href) || /^\/[a-z0-9][^\s]*$/i.test(href);
}

const INLINE = /\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*(.+?)\*\*|__(.+?)__|\*([^*\s](?:.*?[^*\s])?)\*/;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let rest = text;
  while (rest) {
    const m = INLINE.exec(rest);
    if (!m) {
      out.push({ type: "text", value: rest });
      break;
    }
    if (m.index > 0) out.push({ type: "text", value: rest.slice(0, m.index) });
    const [whole, linkText, href, bold, underline, italic] = m;
    if (linkText !== undefined && href !== undefined) {
      out.push(isSafeHref(href) ? { type: "link", href, children: parseInline(linkText) } : { type: "text", value: whole });
    } else if (bold !== undefined) out.push({ type: "strong", children: parseInline(bold) });
    else if (underline !== undefined) out.push({ type: "u", children: parseInline(underline) });
    else if (italic !== undefined) out.push({ type: "em", children: parseInline(italic) });
    rest = rest.slice(m.index + whole.length);
  }
  // Junta textos vizinhos (ex.: link recusado).
  return out.reduce<Inline[]>((acc, node) => {
    const last = acc.at(-1);
    if (node.type === "text" && last?.type === "text") last.value += node.value;
    else acc.push(node);
    return acc;
  }, []);
}

const BULLET = /^\s*[-*]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^(#{2,3})\s+(.*)$/;

export function parseRichText(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ type: "p", lines: paragraph.map(parseInline) });
    paragraph = [];
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = HEADING.exec(line);
    const bullet = BULLET.exec(line);
    const numbered = NUMBERED.exec(line);
    if (!line.trim()) {
      flush();
    } else if (heading) {
      flush();
      blocks.push({ type: heading[1] === "##" ? "h2" : "h3", children: parseInline(heading[2]!.trim()) });
    } else if (bullet || numbered) {
      flush();
      const type = bullet ? "ul" : "ol";
      const item = parseInline((bullet ?? numbered)![1]!.trim());
      const last = blocks.at(-1);
      if (last?.type === type) last.items.push(item);
      else blocks.push({ type, items: [item] });
    } else {
      paragraph.push(line.trim());
    }
  }
  flush();
  return blocks;
}

/** Texto sem marcação (contagem, resumos, busca). */
export function stripRichText(source: string): string {
  return source
    .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*([^*\s](?:.*?[^*\s])?)\*/g, "$1")
    .replace(/^(#{2,3})\s+/gm, "")
    .replace(/^\s*(?:[-*]|\d+[.)])\s+/gm, "");
}

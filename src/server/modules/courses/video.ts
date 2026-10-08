/**
 * Converte URLs de vídeo em URLs de incorporação PERMITIDAS. Qualquer outra
 * origem é recusada (o CSP também só libera estes domínios em frame-src).
 * YouTube usa o domínio "nocookie" (sem cookies de rastreamento).
 */
export function toEmbedUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^www\./, "");
  const id = /^[\w-]{6,20}$/;
  if (host === "youtube.com" || host === "m.youtube.com") {
    const v = url.searchParams.get("v");
    return v && id.test(v) ? `https://www.youtube-nocookie.com/embed/${v}` : null;
  }
  if (host === "youtu.be") {
    const v = url.pathname.slice(1);
    return id.test(v) ? `https://www.youtube-nocookie.com/embed/${v}` : null;
  }
  if (host === "vimeo.com") {
    const v = url.pathname.split("/").filter(Boolean)[0];
    return v && /^\d+$/.test(v) ? `https://player.vimeo.com/video/${v}` : null;
  }
  return null;
}

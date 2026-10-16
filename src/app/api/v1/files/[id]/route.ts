import { z } from "zod";
import { defineRoute } from "@/server/http/route";
import { fileEtag, openFile } from "@/server/modules/files/service";

/**
 * Entrega um arquivo privado após validar sessão, tenant e permissão.
 * Cabeçalhos impedem execução de conteúdo (nosniff + CSP sandbox) e cache compartilhado.
 * `?download=1` entrega como anexo (baixar), com o nome original.
 */
export const GET = defineRoute({
  permission: "authenticated",
  params: z.strictObject({ id: z.uuid() }),
  query: z.strictObject({ download: z.literal("1").optional() }),
  async handler({ actor, params, query, request }) {
    const ifNoneMatch = request.headers.get("if-none-match");
    const file = await openFile(actor, params.id, { ifNoneMatch });
    const headers = {
      "content-type": file.mimeType,
      "content-length": String(file.sizeBytes),
      "content-disposition": `${query.download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      // O id muda a cada envio, então o conteúdo nunca muda. Anexos de conversa expiram mais cedo
      // (a mensagem pode ser apagada); o restante (avatares, capas, banners) fica uma semana no navegador.
      "cache-control": `private, max-age=${file.purpose === "chat_attachment" ? 86400 : 604800}, immutable`,
      etag: fileEtag(file.sha256),
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "cross-origin-resource-policy": "same-origin",
    };
    if (file.body === null) return new Response(null, { status: 304, headers });
    return new Response(file.body as BodyInit, { status: 200, headers });
  },
});

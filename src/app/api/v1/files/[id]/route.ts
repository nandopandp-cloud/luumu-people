import { z } from "zod";
import { defineRoute } from "@/server/http/route";
import { openFile } from "@/server/modules/files/service";

/**
 * Entrega um arquivo privado após validar sessão, tenant e permissão.
 * Cabeçalhos impedem execução de conteúdo (nosniff + CSP sandbox) e cache compartilhado.
 */
export const GET = defineRoute({
  permission: "authenticated",
  params: z.strictObject({ id: z.uuid() }),
  async handler({ actor, params, request }) {
    const file = await openFile(actor, params.id);
    const etag = `"${file.sha256}"`;
    const headers = {
      "content-type": file.mimeType,
      "content-length": String(file.sizeBytes),
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      "cache-control": "private, max-age=86400, immutable",
      etag,
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "cross-origin-resource-policy": "same-origin",
    };
    if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
    return new Response(file.body as BodyInit, { status: 200, headers });
  },
});

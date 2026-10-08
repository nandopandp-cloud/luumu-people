import { badRequest } from "@/server/http/errors";
import { defineRoute } from "@/server/http/route";
import { SENSITIVE_RATE_LIMIT } from "@/server/http/rate-limit";
import { UPLOAD_RULES } from "@/server/files/validate";
import { setMyProfileCover } from "@/server/modules/files/service";

/** Troca a capa do próprio perfil (multipart, campo "file"). */
export const POST = defineRoute({
  permission: "authenticated",
  multipart: { maxBytes: UPLOAD_RULES.profile_cover.maxBytes },
  rateLimit: SENSITIVE_RATE_LIMIT,
  async handler({ actor, request, meta }) {
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) throw badRequest("Envie a imagem no campo “file”.");
    return setMyProfileCover(actor, file, meta);
  },
});

/** Volta para a capa padrão. */
export const DELETE = defineRoute({
  permission: "authenticated",
  rateLimit: SENSITIVE_RATE_LIMIT,
  async handler({ actor, meta }) {
    await setMyProfileCover(actor, null, meta);
  },
});

import { badRequest } from "@/server/http/errors";
import { defineRoute } from "@/server/http/route";
import { SENSITIVE_RATE_LIMIT } from "@/server/http/rate-limit";
import { UPLOAD_RULES } from "@/server/files/validate";
import { setMyAvatar } from "@/server/modules/files/service";

/** Troca a foto do próprio perfil (multipart, campo "file"). */
export const POST = defineRoute({
  permission: "authenticated",
  multipart: { maxBytes: UPLOAD_RULES.avatar.maxBytes },
  rateLimit: SENSITIVE_RATE_LIMIT,
  async handler({ actor, request, meta }) {
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) throw badRequest("Envie a imagem no campo “file”.");
    return setMyAvatar(actor, file, meta);
  },
});

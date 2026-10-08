import { z } from "zod";
import { badRequest } from "@/server/http/errors";
import { defineRoute } from "@/server/http/route";
import { SENSITIVE_RATE_LIMIT } from "@/server/http/rate-limit";
import { FILE_PURPOSES, MAX_UPLOAD_BYTES } from "@/server/files/validate";
import { uploadFile } from "@/server/modules/files/service";

/** Upload de arquivo (multipart, campo "file"). Permissão depende da finalidade. */
export const POST = defineRoute({
  permission: "authenticated",
  query: z.strictObject({ purpose: z.enum(FILE_PURPOSES) }),
  multipart: { maxBytes: MAX_UPLOAD_BYTES },
  rateLimit: SENSITIVE_RATE_LIMIT,
  async handler({ actor, query, request, meta }) {
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) throw badRequest("Envie o arquivo no campo “file”.");
    return Response.json(await uploadFile(actor, query.purpose, file, meta), { status: 201 });
  },
});

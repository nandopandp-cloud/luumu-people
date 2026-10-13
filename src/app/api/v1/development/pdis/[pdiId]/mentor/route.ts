import { z } from "zod";
import { defineRoute } from "@/server/http/route";
import { pdiMentorSchema } from "@/server/modules/development/schemas";
import { setPdiMentor } from "@/server/modules/development/service";

/** Define (ou remove) a mentoria do ciclo e a mensagem para a pessoa — só a liderança. */
export const PUT = defineRoute({
  permission: "authenticated",
  params: z.strictObject({ pdiId: z.uuid() }),
  body: pdiMentorSchema,
  handler: ({ actor, params, body, meta }) => setPdiMentor(actor, params.pdiId, body, meta),
});

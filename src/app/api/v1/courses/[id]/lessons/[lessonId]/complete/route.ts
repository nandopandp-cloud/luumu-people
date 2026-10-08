import { z } from "zod";
import { defineRoute } from "@/server/http/route";
import { completeLesson } from "@/server/modules/courses/service";

/** Marca uma aula como concluída (idempotente); emite certificado ao concluir o curso. */
export const POST = defineRoute({
  permission: "authenticated",
  params: z.strictObject({ id: z.uuid(), lessonId: z.uuid() }),
  handler: ({ actor, params }) => completeLesson(actor, params.id, params.lessonId),
});

import { z } from "zod";
import { defineRoute } from "@/server/http/route";
import { assertModule } from "@/server/modules/flags/modules";
import { completeLesson } from "@/server/modules/courses/service";

/** Marca uma aula como concluída (idempotente); emite certificado ao concluir o curso. */
export const POST = defineRoute({
  permission: "authenticated",
  params: z.strictObject({ id: z.uuid(), lessonId: z.uuid() }),
  async handler({ actor, params }) {
    await assertModule(actor, "learning");
    return completeLesson(actor, params.id, params.lessonId);
  },
});

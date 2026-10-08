import { z } from "zod";
import { defineRoute } from "@/server/http/route";
import { assertModule } from "@/server/modules/flags/modules";
import { startCourse } from "@/server/modules/courses/service";

/** Matrícula voluntária do próprio colaborador em um curso publicado. */
export const POST = defineRoute({
  permission: "authenticated",
  params: z.strictObject({ id: z.uuid() }),
  async handler({ actor, params }) {
    await assertModule(actor, "learning");
    return startCourse(actor, params.id);
  },
});

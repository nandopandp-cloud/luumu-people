import { z } from "zod";
import { defineRoute } from "@/server/http/route";
import { startCourse } from "@/server/modules/courses/service";

/** Matrícula voluntária do próprio colaborador em um curso publicado. */
export const POST = defineRoute({
  permission: "authenticated",
  params: z.strictObject({ id: z.uuid() }),
  handler: ({ actor, params }) => startCourse(actor, params.id),
});

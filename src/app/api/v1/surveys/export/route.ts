import { z } from "zod";
import { parseSurveyParams, toSurveyQuery } from "@/lib/survey-params";
import { defineRoute } from "@/server/http/route";
import { exportSurveysCsv } from "@/server/modules/surveys/overview";

/** Mesmos filtros da página (em português) + `ids` da seleção. Só participação, nunca respostas. */
const exportQuerySchema = z.strictObject({
  q: z.string().max(100).optional(),
  tipo: z.string().max(20).optional(),
  area: z.string().max(40).optional(),
  status: z.string().max(20).optional(),
  de: z.string().max(10).optional(),
  ate: z.string().max(10).optional(),
  ordem: z.string().max(20).optional(),
  dir: z.string().max(4).optional(),
  ids: z
    .string()
    .max(200 * 37)
    .transform((v) => v.split(",").filter(Boolean))
    .pipe(z.array(z.uuid()).max(200))
    .optional(),
});

/** CSV de participação das pesquisas (selecionadas ou filtradas). Auditado (`data.exported`). */
export const GET = defineRoute({
  permission: "reports.export",
  query: exportQuerySchema,
  async handler({ actor, query, meta }) {
    const { ids, ...params } = query;
    const csv = await exportSurveysCsv(actor, { ...toSurveyQuery(parseSurveyParams(params)), ids }, meta);
    const day = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="pesquisas-participacao-${day}.csv"`,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  },
});

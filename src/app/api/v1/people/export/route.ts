import { defineRoute } from "@/server/http/route";
import { exportDirectoryCsv } from "@/server/modules/people/directory";
import { directoryExportSchema } from "@/server/modules/people/schemas";

/** Exporta o diretório filtrado (ou a seleção) em CSV — auditado como `data.exported`. */
export const GET = defineRoute({
  permission: "reports.export",
  query: directoryExportSchema,
  async handler({ actor, query, meta }) {
    const { csv } = await exportDirectoryCsv(actor, query, meta);
    const day = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="colaboradores-${day}.csv"`,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  },
});

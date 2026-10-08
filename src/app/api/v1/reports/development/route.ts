import { defineRoute } from "@/server/http/route";
import { exportDevelopmentCsv } from "@/server/modules/reports/development";

/** Exporta o relatório de desenvolvimento (CSV) das pessoas no escopo de quem exporta. */
export const GET = defineRoute({
  permission: "reports.export",
  async handler({ actor, meta }) {
    const { csv } = await exportDevelopmentCsv(actor, meta);
    const day = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="desenvolvimento-${day}.csv"`,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  },
});

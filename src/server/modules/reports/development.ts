import "server-only";
import { sql } from "drizzle-orm";
import { recordAudit } from "@/server/audit/audit";
import type { AuthenticatedActor } from "@/server/auth/session";
import { accessibleUsersCondition } from "@/server/authz/resolver";
import { withTenant } from "@/server/db/tenant";
import { getCompetencyMatrix, listTeamDevelopment } from "@/server/modules/development/service";

type Meta = { ip: string | null; userAgent: string | null; requestId: string };

/** Célula CSV segura: aspas escapadas e neutralização de fórmulas (CSV injection). */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * Relatório de desenvolvimento em CSV (separador ";" para Excel em pt-BR).
 * Só inclui pessoas no escopo de `development.read` E de `reports.export`.
 */
export async function exportDevelopmentCsv(actor: AuthenticatedActor, meta: Meta): Promise<{ csv: string; rows: number }> {
  const [team, matrix, allowed] = await Promise.all([
    listTeamDevelopment(actor),
    getCompetencyMatrix(actor),
    withTenant(actor, async (tx) => {
      const scope = accessibleUsersCondition(actor, "reports.export", sql`u.id`);
      const result = await tx.execute(sql`select u.id from users u where ${scope}`);
      return new Set((result as unknown as { rows: { id: string }[] }).rows.map((r) => r.id));
    }),
  ]);
  const cells = new Map(matrix.rows.map((r) => [r.id, r.cells]));
  const header = ["Pessoa", "Cargo", "Área", "PDI ativo", "Progresso do PDI (%)", "Ações concluídas", "Ações totais", "Ações atrasadas", "Média das competências (%)", ...matrix.competencies.map((c) => `${c.name} (%)`)];
  const lines = [header.map(csvCell).join(";")];
  let count = 0;
  for (const m of team.members) {
    if (!allowed.has(m.id)) continue;
    const scores = matrix.competencies.map((c) => cells.get(m.id)?.[c.id]?.score ?? null);
    lines.push([m.name, m.position, m.orgUnit, m.hasPdi ? "Sim" : "Não", m.hasPdi ? m.progress : null, m.actionsDone, m.actionsTotal, m.actionsLate, m.averageScore, ...scores].map(csvCell).join(";"));
    count++;
  }
  await withTenant(actor, (tx) =>
    recordAudit(tx, {
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      action: "data.exported",
      resourceType: "report",
      resourceId: null,
      metadata: { report: "development", rows: count },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    }),
  );
  return { csv: `﻿${lines.join("\r\n")}\r\n`, rows: count };
}

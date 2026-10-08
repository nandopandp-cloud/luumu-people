import { Download } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Button } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { EmptyState } from "@/design-system/components/empty-state";
import { Skeleton } from "@/design-system/components/feedback";
import { CompetencyGaps, DevelopmentKpis } from "@/features/development/management";
import { CompetencyMatrix } from "@/features/reports/competency-matrix";
import { hasPermissionAnywhere } from "@/server/authz/policy";
import { requirePermission } from "@/server/dal";
import { getCompetencyMatrix, listTeamCompetencyGaps, listTeamDevelopment } from "@/server/modules/development/service";

export const metadata: Metadata = { title: "Relatórios" };

export default function ReportsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[480px] rounded-xl" />}>
      <Reports />
    </Suspense>
  );
}

async function Reports() {
  const actor = await requirePermission("reports.read");
  const canDevelopment = hasPermissionAnywhere(actor, "development.read");
  const canExport = hasPermissionAnywhere(actor, "reports.export");
  if (!canDevelopment) {
    return (
      <div className="space-y-6">
        <Header canExport={false} />
        <Card>
          <EmptyState title="Nenhum relatório disponível para o seu perfil" description="Os relatórios aparecem conforme as permissões do seu papel." />
        </Card>
      </div>
    );
  }
  const [team, matrix, gaps] = await Promise.all([listTeamDevelopment(actor), getCompetencyMatrix(actor), listTeamCompetencyGaps(actor)]);
  return (
    <div className="space-y-6">
      <Header canExport={canExport} description={team.tenantWide ? "Desenvolvimento de toda a empresa: PDIs, competências e lacunas." : "Desenvolvimento da sua equipe: PDIs, competências e lacunas."} />
      <DevelopmentKpis kpis={team.kpis} />
      <CompetencyMatrix competencies={matrix.competencies} rows={matrix.rows} />
      <CompetencyGaps gaps={gaps} />
    </div>
  );
}

function Header({ canExport, description = "Indicadores das pessoas que você acompanha." }: { canExport: boolean; description?: string }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-h1 font-extrabold tracking-[-0.02em] text-neutral-900">Relatórios</h1>
        <p className="mt-1 text-body text-neutral-600">{description}</p>
      </div>
      {canExport ? (
        <Button asChild variant="secondary">
          <a href="/api/v1/reports/development" download>
            <Download aria-hidden /> Exportar CSV
          </a>
        </Button>
      ) : null}
    </header>
  );
}

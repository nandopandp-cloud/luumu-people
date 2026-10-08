import { BookMarked } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/design-system/components/button";
import { Skeleton } from "@/design-system/components/feedback";
import { CompetencyGaps, DevelopmentKpis } from "@/features/development/management";
import { TeamTable } from "@/features/development/team-table";
import { requirePermission } from "@/server/dal";
import { listTeamCompetencyGaps, listTeamDevelopment } from "@/server/modules/development/service";

export const metadata: Metadata = { title: "Desenvolvimento" };

export default function ManagementDevelopmentPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[480px] rounded-xl" />}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  const actor = await requirePermission("development.read");
  const [team, gaps] = await Promise.all([listTeamDevelopment(actor), listTeamCompetencyGaps(actor)]);
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h1 font-extrabold tracking-[-0.02em] text-neutral-900">Desenvolvimento</h1>
          <p className="mt-1 text-body text-neutral-600">{team.tenantWide ? "PDIs, competências e evolução de toda a empresa." : "PDIs, competências e evolução da sua equipe."}</p>
        </div>
        {team.canManageCatalog ? (
          <Button asChild variant="secondary">
            <Link href="/gestao/desenvolvimento/competencias">
              <BookMarked aria-hidden /> Catálogo de competências
            </Link>
          </Button>
        ) : null}
      </header>
      <DevelopmentKpis kpis={team.kpis} />
      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <TeamTable members={team.members} />
        <CompetencyGaps gaps={gaps} />
      </div>
    </div>
  );
}

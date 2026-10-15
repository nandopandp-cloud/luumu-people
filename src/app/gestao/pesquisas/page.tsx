import { BarChart3, FileText, Plus, Smile, UsersRound, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { forbidden } from "next/navigation";
import { Suspense } from "react";
import { Mascot } from "@/design-system/components/brand";
import { Button } from "@/design-system/components/button";
import { Alert, Skeleton } from "@/design-system/components/feedback";
import { Breadcrumb } from "@/design-system/components/navigation";
import { cn } from "@/design-system/cn";
import { Delta } from "@/features/management/dashboard";
import { SurveyTable } from "@/features/surveys/management/survey-table";
import { SurveyToolbar } from "@/features/surveys/management/toolbar";
import { parseSurveyParams, toSurveyQuery } from "@/lib/survey-params";
import { hasPermissionAnywhere, hasTenantWide } from "@/server/authz/policy";
import { requireActor } from "@/server/dal";
import { getSurveyKpis, listAudienceAreas, listSurveyDirectory } from "@/server/modules/surveys/overview";
import { canReadAllResults } from "@/server/modules/surveys/service";

export const metadata: Metadata = { title: "Pesquisas" };

type SP = PageProps<"/gestao/pesquisas">["searchParams"];

export default function ManagementSurveysPage({ searchParams }: PageProps<"/gestao/pesquisas">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Surveys searchParams={searchParams} />
    </Suspense>
  );
}

const num = new Intl.NumberFormat("pt-BR");

async function Surveys({ searchParams }: { searchParams: SP }) {
  const actor = await requireActor();
  if (!(["survey.design", "survey.launch", "survey.results.read_aggregate"] as const).some((p) => hasPermissionAnywhere(actor, p))) forbidden();
  const params = parseSurveyParams(await searchParams);
  const canDesign = hasTenantWide(actor, "survey.design");
  const canLaunch = hasTenantWide(actor, "survey.launch");
  const [list, kpis, areas] = await Promise.all([listSurveyDirectory(actor, toSurveyQuery(params)), getSurveyKpis(actor), listAudienceAreas(actor)]);
  const filtered = Boolean(params.q || params.tipo || params.area || params.status || params.de || params.ate);

  const cards: { label: string; value: string; hint: string; icon: LucideIcon; tone: string; change: number | null; suffix?: string }[] = [
    {
      label: "Total de pesquisas",
      value: num.format(kpis.total.value),
      hint: kpis.total.change === null ? "criadas até hoje" : "vs. período anterior",
      icon: FileText,
      tone: "bg-purple-100 text-purple-600",
      change: kpis.total.change,
    },
    { label: "Participações totais", value: num.format(kpis.participations.value), hint: "em todas as pesquisas", icon: UsersRound, tone: "bg-blue-100 text-blue-700", change: kpis.participations.change },
    {
      label: "Taxa média de participação",
      value: kpis.averageRate.value === null ? "—" : `${kpis.averageRate.value}%`,
      hint: kpis.averageRate.change === null ? "nas pesquisas abertas" : "vs. período anterior",
      icon: BarChart3,
      tone: "bg-orange-100 text-orange-700",
      change: kpis.averageRate.change,
      suffix: " p.p.",
    },
    ...(kpis.enps
      ? [
          {
            label: "eNPS médio",
            value: kpis.enps.value === null ? "—" : num.format(kpis.enps.value),
            hint: kpis.enps.value === null ? "ainda sem respostas suficientes" : kpis.enps.surveys === 1 ? "última pesquisa" : `últimas ${kpis.enps.surveys} pesquisas`,
            icon: Smile,
            tone: "bg-pink-100 text-pink-700",
            change: kpis.enps.change,
            suffix: "",
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <header className="relative flex flex-wrap items-center gap-6">
        <div aria-hidden className="pointer-events-none absolute -top-10 right-40 hidden size-56 rounded-full bg-purple-100/80 blur-2xl lg:block" />
        <div className="relative min-w-0 flex-[1_1_20rem]">
          <Breadcrumb items={[{ label: "Dashboard", href: "/gestao" }, { label: "Pesquisas" }]} />
          <h1 className="mt-2 text-[2.25rem] font-extrabold leading-tight tracking-[-0.03em] text-neutral-900">Pesquisas</h1>
          <p className="mt-1 text-body text-neutral-600">Crie e gerencie pesquisas de clima, eNPS e pulsos para ouvir sua equipe.</p>
        </div>
        <div aria-hidden className="relative hidden items-start gap-2 lg:flex">
          <p className="mt-1 max-w-44 rounded-2xl rounded-br-sm bg-white px-4 py-3 text-body-sm font-medium leading-snug text-neutral-800 shadow-sm">Escutar pessoas gera grandes transformações! 💜</p>
          <Mascot className="-mb-6 h-32" />
        </div>
        {canDesign ? (
          <div className="relative">
            <Button asChild size="lg" className="shadow-[0_10px_24px_-10px_rgb(124_58_237/0.7)]">
              <Link href="/gestao/pesquisas/nova">
                <Plus aria-hidden /> Nova pesquisa
              </Link>
            </Button>
          </div>
        ) : null}
      </header>

      <section aria-label="Indicadores" className={cn("grid gap-4 sm:grid-cols-2", cards.length === 4 ? "xl:grid-cols-4" : "xl:grid-cols-3")}>
        {cards.map((k) => (
          <div key={k.label} className="card flex items-center gap-4 p-5">
            <span className={cn("flex size-16 shrink-0 items-center justify-center rounded-full", k.tone)}>
              <k.icon aria-hidden className="size-7" />
            </span>
            <div className="min-w-0">
              <p className="text-body-sm text-neutral-600">{k.label}</p>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-h1 font-bold tabular-nums text-neutral-900">{k.value}</span>
                <Delta value={k.change} suffix={k.suffix} />
              </p>
              <p className="text-caption text-neutral-500">{k.hint}</p>
            </div>
          </div>
        ))}
      </section>

      {!canReadAllResults(actor) ? (
        <Alert tone="info" title="Resultados por equipe chegam na próxima etapa">
          Por enquanto, resultados ficam disponíveis para quem tem acesso à empresa toda. Sempre agregados e com o mínimo de respostas que preserva o anonimato.
        </Alert>
      ) : null}

      <section aria-label="Lista de pesquisas" className="card p-5 sm:p-6">
        <SurveyToolbar params={params} counts={list.counts} areas={areas} showDrafts={canDesign || canLaunch} />
        <SurveyTable
          items={list.items.map((s) => ({
            id: s.id,
            title: s.title,
            description: s.description,
            kind: s.kind,
            status: s.status,
            displayStatus: s.displayStatus,
            opensAt: s.opensAt?.toISOString() ?? null,
            closesAt: s.closesAt?.toISOString() ?? null,
            audienceName: s.audienceName,
            audienceSize: s.audienceSize,
            invited: s.invited,
            completed: s.completed,
            rate: s.rate,
          }))}
          params={params}
          total={list.total}
          page={list.page}
          perPage={list.perPage}
          canDesign={canDesign}
          canLaunch={canLaunch}
          canExport={hasTenantWide(actor, "reports.export")}
          filtered={filtered}
        />
      </section>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="Carregando pesquisas">
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[420px] rounded-xl" />
    </div>
  );
}

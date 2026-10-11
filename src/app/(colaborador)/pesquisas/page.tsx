import { Lock } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState } from "@/design-system/components/empty-state";
import { Skeleton } from "@/design-system/components/feedback";
import { CountedHeading, OpenSurveyCard, PastSurveyRow, SurveysHero } from "@/features/surveys/my-surveys";
import { SortSelect } from "@/features/surveys/sort-select";
import { requireActor } from "@/server/dal";
import { listMySurveys } from "@/server/modules/surveys/service";

export const metadata: Metadata = { title: "Pesquisas" };

type SP = PageProps<"/pesquisas">["searchParams"];

export default function SurveysPage({ searchParams }: PageProps<"/pesquisas">) {
  return (
    <>
      <SurveysHero />
      <Suspense fallback={<SurveysSkeleton />}>
        <Surveys searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Surveys({ searchParams }: { searchParams: SP }) {
  const [actor, raw] = await Promise.all([requireActor(), searchParams]);
  const order = raw.ordem === "antigas" ? "antigas" : "recentes";
  const all = await listMySurveys(actor);
  const open = all.filter((s) => s.state === "open").sort((a, b) => a.closesAt.getTime() - b.closesAt.getTime());
  // Respondidas pela data da resposta (só a data é guardada); empate: prazo mais recente primeiro.
  const answered = all
    .filter((s) => s.state === "answered")
    .sort((a, b) => (b.completedOn ?? "").localeCompare(a.completedOn ?? "") || b.closesAt.getTime() - a.closesAt.getTime());
  if (order === "antigas") answered.reverse();
  const missed = all.filter((s) => s.state === "closed");

  return (
    <div className="space-y-9">
      <section aria-labelledby="em-andamento" className="space-y-4">
        <CountedHeading id="em-andamento" count={open.length}>
          {open.length === 1 ? "Pesquisa em andamento" : "Pesquisas em andamento"}
        </CountedHeading>
        {open.length === 0 ? (
          <div className="card p-6">
            <EmptyState compact title="Nenhuma pesquisa aberta para você" description="Quando houver uma nova pesquisa, ela aparece aqui. Obrigado por participar!" />
          </div>
        ) : (
          <ul className="space-y-4">
            {open.map((s) => (
              <li key={s.id}>
                <OpenSurveyCard survey={s} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {answered.length ? (
        <section aria-labelledby="respondidas" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CountedHeading id="respondidas" count={answered.length}>
              {answered.length === 1 ? "Pesquisa respondida" : "Pesquisas respondidas"}
            </CountedHeading>
            {answered.length > 1 ? <SortSelect value={order} /> : null}
          </div>
          <ul className="card divide-y divide-line overflow-hidden p-0">
            {answered.map((s) => (
              <li key={s.id}>
                <PastSurveyRow survey={s} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {missed.length ? (
        <section aria-labelledby="encerradas" className="space-y-4">
          <CountedHeading id="encerradas" count={missed.length}>
            {missed.length === 1 ? "Pesquisa encerrada" : "Pesquisas encerradas"}
          </CountedHeading>
          <ul className="card divide-y divide-line overflow-hidden p-0">
            {missed.map((s) => (
              <li key={s.id}>
                <PastSurveyRow survey={s} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="flex items-start gap-2 text-body-sm text-neutral-600">
        <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-purple-500" />
        Pesquisas anônimas são anônimas de verdade: suas respostas nunca ficam ligadas ao seu nome, e os resultados só aparecem agrupados, com um número mínimo de pessoas.
      </p>
    </div>
  );
}

function SurveysSkeleton() {
  return (
    <div aria-hidden className="space-y-4">
      <Skeleton className="h-7 w-64 rounded-md" />
      <Skeleton className="h-[260px] rounded-xl" />
      <Skeleton className="h-7 w-64 rounded-md" />
      <Skeleton className="h-[180px] rounded-xl" />
    </div>
  );
}

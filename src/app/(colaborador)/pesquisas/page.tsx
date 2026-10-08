import { CalendarClock, CircleCheck, ListChecks, Lock } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/design-system/components/badge";
import { Button } from "@/design-system/components/button";
import { EmptyState } from "@/design-system/components/empty-state";
import { Skeleton } from "@/design-system/components/feedback";
import { PageHero } from "@/features/page/page-hero";
import { formatDay, SURVEY_KIND } from "@/features/surveys/labels";
import { requireActor } from "@/server/dal";
import { listMySurveys, type MySurvey } from "@/server/modules/surveys/service";

export const metadata: Metadata = { title: "Pesquisas" };

export default function SurveysPage() {
  return (
    <>
      <PageHero title="Pesquisas" description="Sua opinião importa! Ajude a construir um ambiente cada vez melhor para todos." bubble="Sua voz faz a diferença!" />
      <Suspense fallback={<Skeleton className="h-[260px] rounded-xl" />}>
        <Surveys />
      </Suspense>
    </>
  );
}

async function Surveys() {
  const actor = await requireActor();
  const all = await listMySurveys(actor);
  const open = all.filter((s) => s.state === "open");
  const past = all.filter((s) => s.state !== "open");

  return (
    <div className="space-y-8">
      <section aria-labelledby="para-responder">
        <h2 id="para-responder" className="mb-3.5 text-[19px] font-bold tracking-[-0.01em] text-neutral-900">
          Para responder <span className="font-semibold text-neutral-600">({open.length})</span>
        </h2>
        {open.length === 0 ? (
          <div className="card p-6">
            <EmptyState compact title="Nenhuma pesquisa aberta para você" description="Quando houver uma nova pesquisa, ela aparece aqui. Obrigado por participar!" />
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {open.map((s) => (
              <li key={s.id}>
                <SurveyCard survey={s} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {past.length ? (
        <section aria-labelledby="historico">
          <h2 id="historico" className="mb-3.5 text-[19px] font-bold tracking-[-0.01em] text-neutral-900">
            Respondidas e encerradas
          </h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-white">
            {past.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm font-semibold text-neutral-900">{s.title}</p>
                  <p className="text-caption text-neutral-500">Encerramento: {formatDay(s.closesAt)}</p>
                </div>
                {s.state === "answered" ? (
                  <Badge tone="green">
                    <CircleCheck aria-hidden /> Respondida
                  </Badge>
                ) : (
                  <Badge tone="neutral">Encerrada</Badge>
                )}
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

function SurveyCard({ survey: s }: { survey: MySurvey }) {
  const kind = SURVEY_KIND[s.kind] ?? SURVEY_KIND.custom!;
  return (
    <article className="flex h-full flex-col rounded-xl border border-line bg-white p-5 shadow-sm">
      <div className="flex flex-wrap gap-1.5">
        <Badge tone={kind.tone}>{kind.label}</Badge>
        <Badge tone="purple">
          <Lock aria-hidden /> Anônima
        </Badge>
      </div>
      <h3 className="mt-3 text-[17px] font-semibold leading-snug text-neutral-900">{s.title}</h3>
      {s.description ? <p className="mt-1 line-clamp-2 text-body-sm text-neutral-600">{s.description}</p> : null}
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-caption text-neutral-500">
        <span className="flex items-center gap-1">
          <ListChecks aria-hidden className="size-3.5" /> {s.questions} {s.questions === 1 ? "pergunta" : "perguntas"}
        </span>
        <span className="flex items-center gap-1">
          <CalendarClock aria-hidden className="size-3.5" /> Responda até {formatDay(s.closesAt)}
        </span>
      </p>
      <Button asChild className="mt-4 self-start">
        <Link href={`/pesquisas/${s.id}` as Route}>Responder pesquisa</Link>
      </Button>
    </article>
  );
}

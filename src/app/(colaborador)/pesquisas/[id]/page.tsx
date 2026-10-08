import { CalendarClock, CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { Badge } from "@/design-system/components/badge";
import { Button } from "@/design-system/components/button";
import { EmptyState } from "@/design-system/components/empty-state";
import { Skeleton } from "@/design-system/components/feedback";
import { Breadcrumb } from "@/design-system/components/navigation";
import { formatDay, SURVEY_KIND } from "@/features/surveys/labels";
import { SurveyForm } from "@/features/surveys/survey-form";
import { requireActor } from "@/server/dal";
import { HttpError } from "@/server/http/errors";
import { getSurveyToAnswer } from "@/server/modules/surveys/service";

export const metadata: Metadata = { title: "Responder pesquisa" };

export default function AnswerSurveyPage({ params }: PageProps<"/pesquisas/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[480px] rounded-xl" />}>
      <Answer params={params} />
    </Suspense>
  );
}

async function Answer({ params }: { params: PageProps<"/pesquisas/[id]">["params"] }) {
  const actor = await requireActor();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  let data: Awaited<ReturnType<typeof getSurveyToAnswer>>;
  try {
    data = await getSurveyToAnswer(actor, id);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
  const { survey, questions, state } = data;
  const kind = SURVEY_KIND[survey.kind] ?? SURVEY_KIND.custom!;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5">
        <Breadcrumb items={[{ label: "Pesquisas", href: "/pesquisas" }, { label: survey.title }]} />
      </div>
      <header className="card mb-5 p-6 sm:p-8">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={kind.tone}>{kind.label}</Badge>
          {survey.closesAt ? (
            <Badge tone="neutral">
              <CalendarClock aria-hidden /> Até {formatDay(survey.closesAt)}
            </Badge>
          ) : null}
        </div>
        <h1 className="mt-3 text-[2rem] font-extrabold leading-tight tracking-[-0.03em] text-neutral-900">{survey.title}</h1>
        {survey.description ? <p className="mt-2 text-body text-neutral-600">{survey.description}</p> : null}
      </header>

      {state === "open" ? (
        <SurveyForm surveyId={survey.id} questions={questions} />
      ) : (
        <div className="card p-6">
          <EmptyState
            title={state === "answered" ? "Você já respondeu esta pesquisa" : "Esta pesquisa está encerrada"}
            description={state === "answered" ? "Obrigado por participar! Cada pessoa responde uma única vez." : "O prazo para respostas terminou."}
            action={
              <Button asChild variant="soft">
                <Link href="/pesquisas">
                  {state === "answered" ? <CircleCheck aria-hidden /> : null} Voltar para pesquisas
                </Link>
              </Button>
            }
          />
        </div>
      )}
    </div>
  );
}

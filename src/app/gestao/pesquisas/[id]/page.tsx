import type { Metadata } from "next";
import { forbidden, notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { Alert, Skeleton } from "@/design-system/components/feedback";
import { Breadcrumb } from "@/design-system/components/navigation";
import { CloseSurveyButton } from "@/features/surveys/close-survey-button";
import { SurveyBuilder } from "@/features/surveys/survey-builder";
import { SurveyResults } from "@/features/surveys/survey-results";
import { SURVEY_DIMENSIONS, type SurveyDimension } from "@/server/db/schema/surveys";
import { hasPermissionAnywhere, hasTenantWide } from "@/server/authz/policy";
import { requireActor } from "@/server/dal";
import { HttpError } from "@/server/http/errors";
import { canReadAllResults, getManagedSurvey, getSurveyResults } from "@/server/modules/surveys/service";

export const metadata: Metadata = { title: "Pesquisa" };

type Props = PageProps<"/gestao/pesquisas/[id]">;

export default function SurveyPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-[640px] rounded-xl" />}>
      <Survey params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function load<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    if (error instanceof HttpError && error.status === 403) forbidden();
    throw error;
  }
}

async function Survey({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const actor = await requireActor();
  if (!(["survey.design", "survey.launch", "survey.results.read_aggregate"] as const).some((p) => hasPermissionAnywhere(actor, p))) forbidden();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { survey, questions, organizationK } = await load(() => getManagedSurvey(actor, id));
  const crumbs = <Breadcrumb items={[{ label: "Pesquisas", href: "/gestao/pesquisas" }, { label: survey.title }]} />;

  if (survey.status === "draft") {
    return (
      <>
        <div className="mb-5">{crumbs}</div>
        <h1 className="mb-6 text-h1 font-extrabold tracking-[-0.02em] text-neutral-900">Editar pesquisa</h1>
        <SurveyBuilder
          survey={{ id: survey.id, title: survey.title, description: survey.description, kind: survey.kind, anonymityK: survey.anonymityK, questions: questions.map((q) => ({ type: q.type, text: q.text, options: q.options ?? undefined, required: q.required })) }}
          organizationK={organizationK}
          canDesign={hasTenantWide(actor, "survey.design")}
          canLaunch={hasTenantWide(actor, "survey.launch")}
        />
      </>
    );
  }

  if (!canReadAllResults(actor)) {
    return (
      <>
        <div className="mb-5">{crumbs}</div>
        <h1 className="mb-4 text-h1 font-extrabold tracking-[-0.02em] text-neutral-900">{survey.title}</h1>
        <Alert tone="info" title="Resultados por equipe chegam na próxima etapa">
          Por enquanto, resultados ficam disponíveis para quem tem acesso à empresa toda.
        </Alert>
      </>
    );
  }

  const raw = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const dimensao = one(raw.dimensao);
  const dimension = (SURVEY_DIMENSIONS as readonly string[]).includes(dimensao ?? "") ? (dimensao as SurveyDimension) : undefined;
  const bucket = one(raw.grupo)?.slice(0, 120);
  const data = await load(() => getSurveyResults(actor, id, { dimension, bucket }));

  return (
    <>
      <div className="mb-5">{crumbs}</div>
      <SurveyResults data={data} basePath={`/gestao/pesquisas/${id}`} actions={survey.status === "active" && hasTenantWide(actor, "survey.launch") ? <CloseSurveyButton surveyId={id} /> : undefined} />
    </>
  );
}

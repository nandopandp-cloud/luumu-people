import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { Avatar } from "@/design-system/components/avatar";
import { Badge } from "@/design-system/components/badge";
import { Skeleton } from "@/design-system/components/feedback";
import { Breadcrumb } from "@/design-system/components/navigation";
import { AssessmentHistory } from "@/features/development/sections";
import { DEVELOPMENT_TABS, DevelopmentTabContent, DevelopmentTabs, type DevelopmentTab } from "@/features/development/view";
import { requirePermission } from "@/server/dal";
import { HttpError } from "@/server/http/errors";
import { getCompetencyEvolution, getDevelopment, listAssessmentHistory } from "@/server/modules/development/service";

export const metadata: Metadata = { title: "Desenvolvimento da pessoa" };

// Recomendações de conteúdo são só para a própria pessoa.
const TABS = [...DEVELOPMENT_TABS.filter((t) => t.value !== "recomendacoes").map((t) => (t.value === "pdi" ? { ...t, label: "PDI" } : t)), { value: "historico", label: "Histórico" }] as const;

export default function PersonDevelopmentPage({ params, searchParams }: PageProps<"/gestao/desenvolvimento/[userId]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[480px] rounded-xl" />}>
      <Person params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Person({ params, searchParams }: PageProps<"/gestao/desenvolvimento/[userId]">) {
  const actor = await requirePermission("development.read");
  const [{ userId }, sp] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(userId).success) notFound();
  const raw = Array.isArray(sp.aba) ? sp.aba[0] : sp.aba;
  const tab = (TABS.some((t) => t.value === raw) ? raw : "visao-geral") as DevelopmentTab;
  const rawPdi = Array.isArray(sp.pdi) ? sp.pdi[0] : sp.pdi;
  const pdiId = z.uuid().safeParse(rawPdi).success ? rawPdi : undefined;

  let development: Awaited<ReturnType<typeof getDevelopment>>;
  try {
    development = await getDevelopment(actor, userId, { pdiId });
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
  const base = `/gestao/desenvolvimento/${userId}`;

  return (
    <div>
      <Breadcrumb items={[{ label: "Desenvolvimento", href: "/gestao/desenvolvimento" }, { label: development.person.name }]} />
      <header className="mb-6 mt-6 flex flex-wrap items-center gap-4">
        <Avatar name={development.person.name} src={development.person.image} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-h1 font-extrabold tracking-[-0.02em] text-neutral-900">{development.person.name}</h1>
          <p className="text-body-sm text-neutral-600">{[development.person.position, development.person.orgUnit].filter(Boolean).join(" · ")}</p>
        </div>
        <Badge tone={development.canManage ? "purple" : "neutral"}>{development.canManage ? "Você lança metas e avaliações" : "Somente leitura"}</Badge>
      </header>
      {tab === "historico" ? (
        <>
          <DevelopmentTabs base={base} tab={tab} development={development} items={TABS} />
          <AssessmentHistory items={await listAssessmentHistory(actor, userId)} />
        </>
      ) : (
        <DevelopmentTabContent
          tab={tab}
          development={development}
          base={base}
          tabs={<DevelopmentTabs base={base} tab={tab} development={development} items={TABS} />}
          managedUserId={userId}
          evolution={tab === "evolucao" || tab === "competencias" ? await getCompetencyEvolution(actor, userId, tab === "competencias" ? 12 : 6) : undefined}
        />
      )}
    </div>
  );
}

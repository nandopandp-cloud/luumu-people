import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { Avatar } from "@/design-system/components/avatar";
import { Skeleton } from "@/design-system/components/feedback";
import { LinkTabs } from "@/design-system/components/link-tabs";
import { Breadcrumb } from "@/design-system/components/navigation";
import { PdiBoard } from "@/features/development/pdi-board";
import { CompetencyGrid, EvolutionPanel, OverviewCards } from "@/features/development/sections";
import { requirePermission } from "@/server/dal";
import { HttpError } from "@/server/http/errors";
import { getCompetencyEvolution, getDevelopment } from "@/server/modules/development/service";

export const metadata: Metadata = { title: "Desenvolvimento da pessoa" };

const TABS = [
  { value: "pdi", label: "PDI" },
  { value: "competencias", label: "Competências" },
  { value: "evolucao", label: "Evolução" },
] as const;

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
  const tab = TABS.some((t) => t.value === raw) ? raw! : "pdi";

  let development: Awaited<ReturnType<typeof getDevelopment>>;
  try {
    development = await getDevelopment(actor, userId);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
  const base = `/gestao/desenvolvimento/${userId}`;

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Desenvolvimento", href: "/gestao/desenvolvimento" }, { label: development.person.name }]} />
      <header className="flex items-center gap-4">
        <Avatar name={development.person.name} src={development.person.image} size="lg" />
        <div>
          <h1 className="text-h1 font-extrabold tracking-[-0.02em] text-neutral-900">{development.person.name}</h1>
          <p className="text-body-sm text-neutral-600">{development.canManage ? "Você pode acompanhar e ajustar o desenvolvimento desta pessoa." : "Somente leitura."}</p>
        </div>
      </header>
      <OverviewCards development={development} pdiHref={base as Route} />
      <LinkTabs label="Seções" current={tab} items={TABS.map((t) => ({ ...t, href: (t.value === "pdi" ? base : `${base}?aba=${t.value}`) as Route }))} />
      {tab === "pdi" ? <PdiBoard development={development} managedUserId={userId} /> : null}
      {tab === "competencias" ? <CompetencyGrid development={development} assessAs={development.canManage ? "manager" : null} /> : null}
      {tab === "evolucao" ? <EvolutionPanel points={await getCompetencyEvolution(actor, userId)} /> : null}
    </div>
  );
}

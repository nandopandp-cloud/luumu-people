import type { Metadata } from "next";
import { Suspense } from "react";
import { z } from "zod";
import { Skeleton } from "@/design-system/components/feedback";
import { DevelopmentHero, PdiHero } from "@/features/development/hero";
import { DEVELOPMENT_TABS, DevelopmentTabContent, DevelopmentTabs, type DevelopmentTab } from "@/features/development/view";
import { requireActor } from "@/server/dal";
import { getCompetencyEvolution, getDevelopment } from "@/server/modules/development/service";

export const metadata: Metadata = { title: "Desenvolvimento" };

type SP = PageProps<"/desenvolvimento">["searchParams"];

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

async function parse(searchParams: SP): Promise<{ tab: DevelopmentTab; pdiId?: string }> {
  const sp = await searchParams;
  const raw = first(sp.aba);
  const tab = DEVELOPMENT_TABS.some((t) => t.value === raw) ? (raw as DevelopmentTab) : "visao-geral";
  const pdi = first(sp.pdi);
  return { tab, pdiId: z.uuid().safeParse(pdi).success ? pdi : undefined };
}

export default function DevelopmentPage({ searchParams }: PageProps<"/desenvolvimento">) {
  return (
    <>
      <Suspense fallback={<Skeleton className="mb-6 h-[220px] rounded-xl" />}>
        <Hero searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-[480px] rounded-xl" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Hero({ searchParams }: { searchParams: SP }) {
  const { tab } = await parse(searchParams);
  return tab === "pdi" ? <PdiHero /> : <DevelopmentHero />;
}

async function Content({ searchParams }: { searchParams: SP }) {
  const [actor, { tab, pdiId }] = await Promise.all([requireActor(), parse(searchParams)]);
  const [development, evolution] = await Promise.all([getDevelopment(actor, actor.userId, { pdiId }), tab === "evolucao" ? getCompetencyEvolution(actor) : undefined]);
  return (
    <>
      <DevelopmentTabs base="/desenvolvimento" tab={tab} development={development} items={DEVELOPMENT_TABS} />
      <DevelopmentTabContent tab={tab} development={development} base="/desenvolvimento" evolution={evolution} />
    </>
  );
}

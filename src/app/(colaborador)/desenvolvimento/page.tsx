import type { Metadata } from "next";
import { Suspense } from "react";
import { z } from "zod";
import { Skeleton } from "@/design-system/components/feedback";
import { DevelopmentHero } from "@/features/development/hero";
import { DevelopmentTabContent, DevelopmentTabs, EMPLOYEE_TABS, type DevelopmentTab } from "@/features/development/view";
import { requireActor } from "@/server/dal";
import { getCompetencyEvolution, getDevelopment } from "@/server/modules/development/service";
import { getEnabledModules } from "@/server/modules/flags/modules";

export const metadata: Metadata = { title: "Desenvolvimento" };

type SP = PageProps<"/desenvolvimento">["searchParams"];

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

async function parse(searchParams: SP): Promise<{ tab: DevelopmentTab; pdiId?: string }> {
  const sp = await searchParams;
  const raw = first(sp.aba);
  const tab = EMPLOYEE_TABS.some((t) => t.value === raw) ? (raw as DevelopmentTab) : "visao-geral";
  const pdi = first(sp.pdi);
  return { tab, pdiId: z.uuid().safeParse(pdi).success ? pdi : undefined };
}

/** O banner é o mesmo em todas as abas ("Seu crescimento é único."). */
export default function DevelopmentPage({ searchParams }: PageProps<"/desenvolvimento">) {
  return (
    <>
      <DevelopmentHero />
      <Suspense fallback={<Skeleton className="h-[480px] rounded-xl" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Content({ searchParams }: { searchParams: SP }) {
  const [actor, { tab, pdiId }] = await Promise.all([requireActor(), parse(searchParams)]);
  const [development, evolution, modules] = await Promise.all([
    getDevelopment(actor, actor.userId, { pdiId }),
    tab === "evolucao" || tab === "competencias" ? getCompetencyEvolution(actor, actor.userId, tab === "competencias" ? 12 : 6) : undefined,
    getEnabledModules(actor),
  ]);
  return (
    <DevelopmentTabContent
      tab={tab}
      development={development}
      base="/desenvolvimento"
      tabs={<DevelopmentTabs base="/desenvolvimento" tab={tab} development={development} items={EMPLOYEE_TABS} />}
      evolution={evolution}
      learningEnabled={modules.learning}
      showAchievements={false}
      showRecommendations={false}
    />
  );
}

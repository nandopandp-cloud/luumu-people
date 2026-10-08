import type { Metadata, Route } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/design-system/components/feedback";
import { LinkTabs } from "@/design-system/components/link-tabs";
import { PageHero } from "@/features/page/page-hero";
import { PathsSection } from "@/features/paths/sections";
import { requireActor } from "@/server/dal";
import { PATH_TABS, type PathTab } from "@/server/modules/learning/service";

export const metadata: Metadata = { title: "Trilhas" };

const TAB_LABELS: Record<PathTab, string> = { todas: "Todas", "em-andamento": "Em andamento", "nao-iniciadas": "Não iniciadas", concluidas: "Concluídas" };

type SP = PageProps<"/trilhas">["searchParams"];

async function parseTab(searchParams: SP): Promise<PathTab> {
  const raw = (await searchParams).aba;
  const aba = Array.isArray(raw) ? raw[0] : raw;
  return (PATH_TABS as readonly string[]).includes(aba ?? "") ? (aba as PathTab) : "todas";
}

export default function PathsPage({ searchParams }: PageProps<"/trilhas">) {
  return (
    <>
      <Suspense fallback={<Skeleton className="mb-6 h-[230px] rounded-xl" />}>
        <Hero searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<Cards />}>
        <Paths searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Hero({ searchParams }: { searchParams: SP }) {
  const tab = await parseTab(searchParams);
  return (
    <PageHero
      title="Trilhas de Aprendizagem"
      description="Desenvolva suas habilidades com jornadas personalizadas e conteúdos práticos para o seu crescimento."
      bubble="Pequenos aprendizados constroem grandes futuros!"
    >
      <LinkTabs
        label="Situação das trilhas"
        current={tab}
        items={PATH_TABS.map((t) => ({ value: t, label: TAB_LABELS[t], href: (t === "todas" ? "/trilhas" : `/trilhas?aba=${t}`) as Route }))}
      />
    </PageHero>
  );
}

async function Paths({ searchParams }: { searchParams: SP }) {
  const [actor, tab] = await Promise.all([requireActor(), parseTab(searchParams)]);
  return <PathsSection actor={actor} tab={tab} />;
}

function Cards() {
  return (
    <div aria-hidden>
      <Skeleton className="mb-3.5 h-6 w-48" />
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[330px] rounded-xl" />
        ))}
      </div>
    </div>
  );
}

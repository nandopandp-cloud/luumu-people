import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState } from "@/design-system/components/empty-state";
import { Skeleton } from "@/design-system/components/feedback";
import { Breadcrumb } from "@/design-system/components/navigation";
import { UpcomingEventsCard } from "@/features/announcements/mural/sections";
import { requireActor } from "@/server/dal";
import { listUpcomingEvents } from "@/server/modules/communication/events";

export const metadata: Metadata = { title: "Agenda de eventos" };

export default function EventsPage() {
  return (
    <>
      <div className="mb-5">
        <Breadcrumb items={[{ label: "Comunicados", href: "/comunicados" }, { label: "Agenda de eventos" }]} />
      </div>
      <h1 className="mb-1 text-h1 font-extrabold tracking-[-0.02em] text-neutral-900">Agenda de eventos</h1>
      <p className="mb-6 text-body text-neutral-600">Encontros, treinamentos e celebrações da empresa.</p>
      <Suspense fallback={<Skeleton className="h-[420px] max-w-3xl rounded-xl" />}>
        <List />
      </Suspense>
    </>
  );
}

async function List() {
  const events = await listUpcomingEvents(await requireActor(), 100);
  if (events.length === 0) {
    return (
      <div className="card max-w-3xl p-6">
        <EmptyState title="Nenhum evento agendado por enquanto" description="Quando houver encontros ou treinamentos, eles aparecem aqui." />
      </div>
    );
  }
  return (
    <div className="max-w-3xl">
      <UpcomingEventsCard events={events} seeAll={false} />
    </div>
  );
}

import { ChevronRight, Plus } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/design-system/components/badge";
import { Button } from "@/design-system/components/button";
import { EmptyState } from "@/design-system/components/empty-state";
import { Skeleton } from "@/design-system/components/feedback";
import { EVENT_KIND, eventDay, eventMonth, eventTime, eventWhere } from "@/features/announcements/mural/labels";
import { CommunicationTabs } from "@/features/banners/communication-tabs";
import { requirePermission } from "@/server/dal";
import { listManagedEvents } from "@/server/modules/communication/events";

export const metadata: Metadata = { title: "Eventos" };

export default function ManagedEventsPage() {
  return (
    <>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h1 font-extrabold tracking-[-0.02em] text-neutral-900">Eventos</h1>
          <p className="mt-1 text-body text-neutral-600">A agenda que aparece em “Próximos eventos”, no mural de comunicados.</p>
        </div>
        <Button asChild>
          <Link href="/gestao/comunicacao/eventos/novo">
            <Plus aria-hidden /> Novo evento
          </Link>
        </Button>
      </header>
      <Suspense fallback={<Skeleton className="h-[320px] rounded-xl" />}>
        <List />
      </Suspense>
    </>
  );
}

async function List() {
  const actor = await requirePermission("comms.event.manage");
  const events = await listManagedEvents(actor);
  return (
    <>
      <CommunicationTabs current="eventos" actor={actor} />
      {events.length === 0 ? (
        <div className="card p-6">
          <EmptyState title="Nenhum evento na agenda" description="Crie encontros, treinamentos e celebrações para que apareçam no mural." />
        </div>
      ) : (
        <ul className="card divide-y divide-line">
          {events.map((e) => {
            const kind = EVENT_KIND[e.kind] ?? { label: e.kind, tone: "purple" as const };
            return (
              <li key={e.id}>
                <Link href={`/gestao/comunicacao/eventos/${e.id}` as Route} className="group flex items-center gap-4 px-5 py-4 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-purple-500">
                  <span aria-hidden className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-purple-50 py-1.5 text-purple-600">
                    <span className="text-h3 font-extrabold leading-none">{eventDay(e.startsAt)}</span>
                    <span className="mt-0.5 text-caption font-semibold">{eventMonth(e.startsAt)}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge tone={kind.tone}>{kind.label}</Badge>
                      {e.ended ? <Badge tone="neutral">Encerrado</Badge> : e.published ? <Badge tone="green">Publicado</Badge> : <Badge tone="neutral">Rascunho</Badge>}
                    </span>
                    <span className="mt-1 block truncate font-semibold text-neutral-900 group-hover:text-purple-600">{e.title}</span>
                    <span className="text-body-sm text-neutral-600">
                      {eventTime(e.startsAt)} • {eventWhere(e)}
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="size-4 text-neutral-500" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

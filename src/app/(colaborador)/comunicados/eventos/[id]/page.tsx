import { CalendarDays, Clock3, ExternalLink, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { Badge } from "@/design-system/components/badge";
import { Button } from "@/design-system/components/button";
import { Skeleton } from "@/design-system/components/feedback";
import { Breadcrumb } from "@/design-system/components/navigation";
import { EVENT_KIND, eventDay, eventMonth, eventTime, eventWhere } from "@/features/announcements/mural/labels";
import { requireActor } from "@/server/dal";
import { HttpError } from "@/server/http/errors";
import { getEvent } from "@/server/modules/communication/events";

export const metadata: Metadata = { title: "Evento" };

const longDate = (d: Date) => new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" }).format(d);

export default function EventPage({ params }: PageProps<"/comunicados/eventos/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[360px] max-w-3xl rounded-xl" />}>
      <Event params={params} />
    </Suspense>
  );
}

async function Event({ params }: { params: PageProps<"/comunicados/eventos/[id]">["params"] }) {
  const actor = await requireActor();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  let e: Awaited<ReturnType<typeof getEvent>>;
  try {
    e = await getEvent(actor, id);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
  const kind = EVENT_KIND[e.kind] ?? { label: e.kind, tone: "purple" as const };
  const paragraphs = (e.description ?? "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  return (
    <>
      <div className="mb-5">
        <Breadcrumb items={[{ label: "Comunicados", href: "/comunicados" }, { label: "Agenda de eventos", href: "/comunicados/eventos" }, { label: e.title }]} />
      </div>
      <article className="card max-w-3xl p-6 sm:p-8">
        <div className="flex items-start gap-5">
          <span aria-hidden className="flex w-20 shrink-0 flex-col items-center rounded-lg bg-purple-50 py-3 text-purple-600">
            <span className="text-h1 font-extrabold leading-none">{eventDay(e.startsAt)}</span>
            <span className="mt-1 text-body-sm font-semibold">{eventMonth(e.startsAt)}</span>
          </span>
          <div className="min-w-0">
            <Badge tone={kind.tone}>{kind.label}</Badge>
            <h1 className="mt-2 text-h1 font-extrabold leading-tight tracking-[-0.02em] text-neutral-900">{e.title}</h1>
          </div>
        </div>
        <ul className="mt-6 space-y-2 text-body text-neutral-700">
          <li className="flex items-center gap-2">
            <CalendarDays aria-hidden className="size-5 text-purple-500" />
            <span className="first-letter:uppercase">{longDate(e.startsAt)}</span>
          </li>
          <li className="flex items-center gap-2">
            <Clock3 aria-hidden className="size-5 text-purple-500" />
            <span>
              <time dateTime={e.startsAt.toISOString()}>{eventTime(e.startsAt)}</time>
              {e.endsAt ? (
                <>
                  {" "}
                  às <time dateTime={e.endsAt.toISOString()}>{eventTime(e.endsAt)}</time>
                </>
              ) : null}{" "}
              (horário de Brasília)
            </span>
          </li>
          <li className="flex items-center gap-2">
            <MapPin aria-hidden className="size-5 text-purple-500" />
            {eventWhere(e)}
          </li>
        </ul>
        {paragraphs.length ? (
          <div className="mt-6 space-y-4 border-t border-line pt-6 text-body leading-relaxed text-neutral-800">
            {paragraphs.map((p, i) => (
              <p key={i} className="whitespace-pre-line">
                {p}
              </p>
            ))}
          </div>
        ) : null}
        {e.url ? (
          <Button asChild className="mt-6">
            <a href={e.url} target="_blank" rel="noopener noreferrer">
              {e.mode === "presencial" ? "Mais informações" : "Acessar o evento"} <ExternalLink aria-hidden />
              <span className="sr-only"> (abre em nova aba)</span>
            </a>
          </Button>
        ) : null}
      </article>
    </>
  );
}

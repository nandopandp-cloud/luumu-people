import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { Skeleton } from "@/design-system/components/feedback";
import { Breadcrumb } from "@/design-system/components/navigation";
import { toLocalInput } from "@/features/banners/format";
import { EventEditor } from "@/features/communication/event-editor";
import { requirePermission } from "@/server/dal";
import { HttpError } from "@/server/http/errors";
import { getManagedEvent } from "@/server/modules/communication/events";

export const metadata: Metadata = { title: "Editar evento" };

export default function EditEventPage({ params }: PageProps<"/gestao/comunicacao/eventos/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[560px] max-w-3xl rounded-xl" />}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: { params: PageProps<"/gestao/comunicacao/eventos/[id]">["params"] }) {
  const actor = await requirePermission("comms.event.manage");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  let e: Awaited<ReturnType<typeof getManagedEvent>>;
  try {
    e = await getManagedEvent(actor, id);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
  return (
    <>
      <div className="mb-5">
        <Breadcrumb items={[{ label: "Comunicação", href: "/gestao/comunicacao" }, { label: "Eventos", href: "/gestao/comunicacao/eventos" }, { label: e.title }]} />
      </div>
      <h1 className="mb-6 text-h1 font-extrabold tracking-[-0.02em] text-neutral-900">Editar evento</h1>
      <EventEditor
        event={{
          id: e.id,
          title: e.title,
          description: e.description ?? "",
          kind: e.kind,
          mode: e.mode,
          location: e.location ?? "",
          url: e.url ?? "",
          startsAt: toLocalInput(e.startsAt),
          endsAt: toLocalInput(e.endsAt),
          published: e.published,
        }}
      />
    </>
  );
}

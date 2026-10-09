import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/design-system/components/feedback";
import { Breadcrumb } from "@/design-system/components/navigation";
import { EventEditor } from "@/features/communication/event-editor";
import { requirePermission } from "@/server/dal";

export const metadata: Metadata = { title: "Novo evento" };

export default function NewEventPage() {
  return (
    <>
      <div className="mb-5">
        <Breadcrumb items={[{ label: "Comunicação", href: "/gestao/comunicacao" }, { label: "Eventos", href: "/gestao/comunicacao/eventos" }, { label: "Novo evento" }]} />
      </div>
      <h1 className="mb-6 text-h1 font-extrabold tracking-[-0.02em] text-neutral-900">Novo evento</h1>
      <Suspense fallback={<Skeleton className="h-[560px] max-w-3xl rounded-xl" />}>
        <Editor />
      </Suspense>
    </>
  );
}

async function Editor() {
  await requirePermission("comms.event.manage");
  return <EventEditor event={{ title: "", description: "", kind: "evento", mode: "online", location: "", url: "", startsAt: "", endsAt: "", published: true }} />;
}

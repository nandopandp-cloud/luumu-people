import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/design-system/components/feedback";
import { CommunicationTabs } from "@/features/banners/communication-tabs";
import { QuickLinkManager } from "@/features/communication/quick-link-manager";
import { requirePermission } from "@/server/dal";
import { listManagedQuickLinks } from "@/server/modules/communication/quick-links";

export const metadata: Metadata = { title: "Links rápidos" };

export default function QuickLinksPage() {
  return (
    <>
      <header className="mb-5">
        <h1 className="text-h1 font-extrabold tracking-[-0.02em] text-neutral-900">Links rápidos</h1>
        <p className="mt-1 text-body text-neutral-600">Atalhos para benefícios, políticas e canais de ajuda, exibidos no mural de comunicados.</p>
      </header>
      <Suspense fallback={<Skeleton className="h-[320px] rounded-xl" />}>
        <Manager />
      </Suspense>
    </>
  );
}

async function Manager() {
  const actor = await requirePermission("comms.quicklink.manage");
  const links = await listManagedQuickLinks(actor);
  return (
    <>
      <CommunicationTabs current="links" actor={actor} />
      <QuickLinkManager
        // Remonta quando a lista muda no servidor (o componente guarda estado otimista).
        key={links.map((l) => `${l.id}:${l.position}:${l.active}:${l.label}:${l.url}:${l.icon}:${l.color}`).join("|")}
        links={links.map(({ id, label, url, icon, color, active }) => ({ id, label, url, icon, color, active }))}
      />
    </>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/design-system/components/feedback";
import { Breadcrumb } from "@/design-system/components/navigation";
import { AnnouncementEditor } from "@/features/announcements/announcement-editor";
import { hasTenantWide } from "@/server/authz/policy";
import { requirePermission } from "@/server/dal";
import { toAudienceOptions } from "@/features/announcements/audience-options";
import { listAudienceOptions } from "@/server/modules/announcements/service";

export const metadata: Metadata = { title: "Novo comunicado" };

export default function NewAnnouncementPage() {
  return (
    <>
      <div className="mb-5">
        <Breadcrumb items={[{ label: "Comunicação", href: "/gestao/comunicacao" }, { label: "Novo comunicado" }]} />
      </div>
      <h1 className="mb-6 text-h1 font-extrabold tracking-[-0.02em] text-neutral-900">Novo comunicado</h1>
      <Suspense fallback={<Skeleton className="h-[560px] rounded-xl" />}>
        <Editor />
      </Suspense>
    </>
  );
}

async function Editor() {
  const actor = await requirePermission("comms.announcement.create");
  return <AnnouncementEditor canPublish={hasTenantWide(actor, "comms.announcement.publish")} audienceOptions={toAudienceOptions(await listAudienceOptions(actor))} />;
}

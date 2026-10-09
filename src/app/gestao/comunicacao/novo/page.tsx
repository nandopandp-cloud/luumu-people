import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/design-system/components/feedback";
import { EditorHeader } from "@/features/announcements/editor-header";
import { AnnouncementEditor } from "@/features/announcements/announcement-editor";
import { hasTenantWide } from "@/server/authz/policy";
import { requirePermission } from "@/server/dal";
import { toAudienceOptions } from "@/features/announcements/audience-options";
import { listAudienceOptions } from "@/server/modules/announcements/service";

export const metadata: Metadata = { title: "Novo comunicado" };

export default function NewAnnouncementPage() {
  return (
    <>
      <EditorHeader title="Novo comunicado" description="Preencha as informações, revise a prévia e publique para sua audiência." current="Novo comunicado" />
      <Suspense fallback={<Skeleton className="h-[720px] rounded-xl" />}>
        <Editor />
      </Suspense>
    </>
  );
}

async function Editor() {
  const actor = await requirePermission("comms.announcement.create");
  return <AnnouncementEditor canPublish={hasTenantWide(actor, "comms.announcement.publish")} audienceOptions={toAudienceOptions(await listAudienceOptions(actor))} />;
}

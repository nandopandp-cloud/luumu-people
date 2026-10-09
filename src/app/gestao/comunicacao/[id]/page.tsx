import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { Skeleton } from "@/design-system/components/feedback";
import { AnnouncementEditor } from "@/features/announcements/announcement-editor";
import { toAudienceOptions } from "@/features/announcements/audience-options";
import { EditorHeader } from "@/features/announcements/editor-header";
import { hasTenantWide } from "@/server/authz/policy";
import { requirePermission } from "@/server/dal";
import { HttpError } from "@/server/http/errors";
import { getManagedAnnouncement, listAudienceOptions } from "@/server/modules/announcements/service";

export const metadata: Metadata = { title: "Editar comunicado" };

export default function EditAnnouncementPage({ params }: PageProps<"/gestao/comunicacao/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[560px] rounded-xl" />}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: { params: PageProps<"/gestao/comunicacao/[id]">["params"] }) {
  const actor = await requirePermission("comms.announcement.create");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  let a: Awaited<ReturnType<typeof getManagedAnnouncement>>;
  let units: Awaited<ReturnType<typeof listAudienceOptions>>;
  try {
    [a, units] = await Promise.all([getManagedAnnouncement(actor, id), listAudienceOptions(actor)]);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
  return (
    <>
      <EditorHeader title="Editar comunicado" description="Altere as informações, revise a prévia e publique para sua audiência." current="Editar comunicado" />
      <AnnouncementEditor
        canPublish={hasTenantWide(actor, "comms.announcement.publish")}
        audienceOptions={toAudienceOptions(units)}
        announcement={{
          id: a.id,
          title: a.title,
          summary: a.summary,
          body: a.body ?? "",
          category: a.category,
          theme: a.theme,
          illustration: a.illustration,
          pinned: a.pinned,
          coverFileId: a.coverFileId,
          audienceOrgUnitId: a.audienceOrgUnitId ?? "",
          attachments: a.attachments.map((x) =>
            x.kind === "file" ? { kind: "file" as const, title: x.title, fileId: x.fileId!, mimeType: x.mimeType, sizeBytes: x.sizeBytes } : { kind: "video" as const, title: x.title, videoUrl: x.videoUrl! },
          ),
          managedStatus: a.managedStatus,
          publishedAt: a.publishedAt?.toISOString() ?? null,
          likes: a.likes,
          comments: a.comments,
        }}
      />
    </>
  );
}

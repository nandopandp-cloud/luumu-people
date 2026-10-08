import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { Skeleton } from "@/design-system/components/feedback";
import { Breadcrumb } from "@/design-system/components/navigation";
import { BannerEditor } from "@/features/banners/banner-editor";
import { toLocalInput } from "@/features/banners/format";
import { requirePermission } from "@/server/dal";
import { HttpError } from "@/server/http/errors";
import { getManagedBanner } from "@/server/modules/banners/service";

export const metadata: Metadata = { title: "Editar banner" };

export default function EditBannerPage({ params }: PageProps<"/gestao/comunicacao/banners/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[640px] rounded-xl" />}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: { params: PageProps<"/gestao/comunicacao/banners/[id]">["params"] }) {
  const actor = await requirePermission("comms.announcement.publish");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  let b: Awaited<ReturnType<typeof getManagedBanner>>;
  try {
    b = await getManagedBanner(actor, id);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
  return (
    <>
      <div className="mb-5">
        <Breadcrumb items={[{ label: "Comunicação", href: "/gestao/comunicacao" }, { label: "Banners da home", href: "/gestao/comunicacao/banners" }, { label: b.title }]} />
      </div>
      <h1 className="mb-6 text-h1 font-extrabold tracking-[-0.02em] text-neutral-900">Editar banner</h1>
      <BannerEditor
        banner={{
          id: b.id,
          title: b.title,
          subtitle: b.subtitle ?? "",
          ctaLabel: b.ctaLabel ?? "",
          ctaUrl: b.ctaUrl ?? "",
          theme: b.theme,
          illustration: b.illustration ?? "",
          imageFileId: b.imageFileId,
          active: b.active,
          startsAt: toLocalInput(b.startsAt),
          endsAt: toLocalInput(b.endsAt),
        }}
      />
    </>
  );
}

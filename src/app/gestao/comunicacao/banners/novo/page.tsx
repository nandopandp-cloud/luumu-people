import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/design-system/components/feedback";
import { Breadcrumb } from "@/design-system/components/navigation";
import { BannerEditor } from "@/features/banners/banner-editor";
import { requirePermission } from "@/server/dal";

export const metadata: Metadata = { title: "Novo banner" };

export default function NewBannerPage() {
  return (
    <>
      <div className="mb-5">
        <Breadcrumb items={[{ label: "Comunicação", href: "/gestao/comunicacao" }, { label: "Banners da home", href: "/gestao/comunicacao/banners" }, { label: "Novo banner" }]} />
      </div>
      <h1 className="mb-6 text-h1 font-extrabold tracking-[-0.02em] text-neutral-900">Novo banner</h1>
      <Suspense fallback={<Skeleton className="h-[640px] rounded-xl" />}>
        <Editor />
      </Suspense>
    </>
  );
}

async function Editor() {
  await requirePermission("comms.announcement.publish");
  return (
    <BannerEditor
      banner={{ title: "", subtitle: "", ctaLabel: "", ctaUrl: "", theme: "purple", illustration: "", imageFileId: null, active: true, startsAt: "", endsAt: "" }}
    />
  );
}

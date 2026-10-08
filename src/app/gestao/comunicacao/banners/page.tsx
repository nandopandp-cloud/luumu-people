import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/design-system/components/button";
import { EmptyState } from "@/design-system/components/empty-state";
import { Alert, Skeleton } from "@/design-system/components/feedback";
import { BannerList } from "@/features/banners/banner-list";
import { CommunicationTabs } from "@/features/banners/communication-tabs";
import { formatDateTime } from "@/lib/format";
import { requirePermission } from "@/server/dal";
import { listManagedBanners } from "@/server/modules/banners/service";

export const metadata: Metadata = { title: "Banners da home" };

export default function BannersPage() {
  return (
    <>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h1 font-extrabold tracking-[-0.02em] text-neutral-900">Banners da home</h1>
          <p className="mt-1 text-body text-neutral-600">O destaque principal da página inicial de todas as pessoas. Vários ativos viram um carrossel.</p>
        </div>
        <Button asChild>
          <Link href="/gestao/comunicacao/banners/novo">
            <Plus aria-hidden /> Novo banner
          </Link>
        </Button>
      </header>
      <CommunicationTabs current="banners" canManageBanners />
      <Suspense fallback={<Skeleton className="h-[320px] rounded-xl" />}>
        <List />
      </Suspense>
    </>
  );
}

function period(startsAt: Date | null, endsAt: Date | null) {
  if (!startsAt && !endsAt) return null;
  if (startsAt && endsAt) return `De ${formatDateTime(startsAt)} até ${formatDateTime(endsAt)}`;
  return startsAt ? `A partir de ${formatDateTime(startsAt)}` : `Até ${formatDateTime(endsAt!)}`;
}

async function List() {
  const actor = await requirePermission("comms.announcement.publish");
  const banners = await listManagedBanners(actor);
  if (banners.length === 0) {
    return (
      <div className="card p-6">
        <EmptyState
          title="Nenhum banner criado"
          description="Enquanto não houver banner ativo, a home mostra a mensagem de boas-vindas padrão."
          action={
            <Button asChild variant="soft">
              <Link href="/gestao/comunicacao/banners/novo">
                <Plus aria-hidden /> Criar o primeiro banner
              </Link>
            </Button>
          }
        />
      </div>
    );
  }
  const live = banners.filter((b) => b.status === "live").length;
  return (
    <div className="space-y-4">
      <Alert tone="info" title={live === 0 ? "Nenhum banner no ar agora: a home mostra a boas-vindas padrão." : `${live} ${live === 1 ? "banner no ar" : "banners no ar, em carrossel"} na home.`}>
        Use as setas para definir a ordem do carrossel.
      </Alert>
      <BannerList
        // Remonta quando a lista muda no servidor (o componente guarda estado otimista).
        key={banners.map((b) => `${b.id}:${b.position}:${b.active}`).join("|")}
        banners={banners.map((b) => ({
          id: b.id,
          title: b.title,
          subtitle: b.subtitle,
          theme: b.theme,
          illustration: b.illustration,
          imageFileId: b.imageFileId,
          active: b.active,
          status: b.status,
          period: period(b.startsAt, b.endsAt),
          payload: {
            title: b.title,
            subtitle: b.subtitle,
            ctaLabel: b.ctaLabel,
            ctaUrl: b.ctaUrl,
            theme: b.theme,
            illustration: b.illustration,
            imageFileId: b.imageFileId,
            startsAt: b.startsAt?.toISOString() ?? null,
            endsAt: b.endsAt?.toISOString() ?? null,
          },
        }))}
      />
    </div>
  );
}

import { ChevronLeft, Info, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/design-system/components/button";
import { EmptyState } from "@/design-system/components/empty-state";
import { Skeleton } from "@/design-system/components/feedback";
import { Mascot } from "@/design-system/components/brand";
import { BannerList } from "@/features/banners/banner-list";
import { requirePermission } from "@/server/dal";
import { listManagedBanners } from "@/server/modules/banners/service";

export const metadata: Metadata = { title: "Banners da home" };

export default function BannersPage() {
  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/gestao/comunicacao" className="mb-3 inline-flex items-center gap-1 text-body-sm text-neutral-600 hover:text-purple-600">
            <ChevronLeft aria-hidden className="size-4" /> Comunicação
          </Link>
          <h1 className="text-display font-extrabold leading-tight tracking-[-0.03em] text-neutral-900">Banners da home</h1>
          <p className="mt-1 text-[17px] text-neutral-600">Destaques exibidos na página inicial dos colaboradores.</p>
        </div>
        <Button asChild size="lg" className="h-12 px-6 shadow-md">
          <Link href="/gestao/comunicacao/banners/novo">
            <Plus aria-hidden /> Novo banner
          </Link>
        </Button>
      </header>
      <Suspense fallback={<Skeleton className="h-[420px] rounded-xl" />}>
        <List />
      </Suspense>
    </>
  );
}

const fmtDate = (d: Date) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" }).format(d);

function period(startsAt: Date | null, endsAt: Date | null) {
  if (startsAt && endsAt) return `${fmtDate(startsAt)} a ${fmtDate(endsAt)}`;
  if (startsAt) return `A partir de ${fmtDate(startsAt)}`;
  if (endsAt) return `Até ${fmtDate(endsAt)}`;
  return "Sem prazo definido";
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
    <div className="space-y-5">
      <section aria-label="Situação do carrossel" className="relative overflow-hidden rounded-xl border border-purple-100 bg-gradient-to-r from-purple-50 via-purple-50 to-purple-100 px-6 py-5">
        <div aria-hidden className="pointer-events-none absolute -right-6 -top-10 hidden h-40 w-72 rounded-full bg-purple-100 blur-2xl md:block" />
        <Mascot className="pointer-events-none absolute -bottom-6 right-10 hidden h-28 md:block" />
        <div className="relative flex items-start gap-4 md:pr-48">
          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-purple-600 shadow-sm">
            <Info className="size-5" />
          </span>
          <div>
            <p className="text-h4 font-bold text-purple-700">{live === 0 ? "Nenhum banner no ar agora" : `${live} ${live === 1 ? "banner ativo" : "banners ativos"}`}</p>
            <p className="mt-0.5 text-body-sm text-neutral-700">
              {live === 0 ? "A página inicial mostra a boas-vindas padrão." : "Os banners ativos aparecem em um carrossel na página inicial."} Arraste para reorganizar.
            </p>
          </div>
        </div>
      </section>
      <BannerList
        // Remonta quando a lista muda no servidor (o componente guarda estado otimista).
        key={banners.map((b) => `${b.id}:${b.position}:${b.active}`).join("|")}
        banners={banners.map((b) => ({
          id: b.id,
          layout: b.layout,
          title: b.title,
          subtitle: b.subtitle,
          theme: b.theme,
          illustration: b.illustration,
          imageFileId: b.imageFileId,
          active: b.active,
          status: b.status,
          period: period(b.startsAt, b.endsAt),
          payload: {
            layout: b.layout,
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

"use client";

import { ArrowDown, ArrowUp, Pencil } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/design-system/components/badge";
import { IconButton } from "@/design-system/components/button";
import { Switch } from "@/design-system/components/choice";
import { useToast } from "@/design-system/components/toast";
import { CoverArt, type CoverIllustration, type CoverTheme } from "@/design-system/illustrations/cover-art";
import { cn } from "@/design-system/cn";
import { api, ApiError } from "@/lib/api-client";

export type ListedBanner = {
  id: string;
  title: string;
  subtitle: string | null;
  theme: CoverTheme;
  illustration: CoverIllustration | null;
  imageFileId: string | null;
  active: boolean;
  status: "live" | "scheduled" | "ended" | "inactive";
  period: string | null;
  // Campos necessários para salvar a troca de "ativo" sem perder o resto.
  payload: Record<string, unknown>;
};

const STATUS = {
  live: { label: "No ar", tone: "green" },
  scheduled: { label: "Agendado", tone: "blue" },
  ended: { label: "Encerrado", tone: "neutral" },
  inactive: { label: "Inativo", tone: "neutral" },
} as const;

/** Lista de banners: ordem do carrossel, ativar/desativar e editar. */
export function BannerList({ banners }: { banners: ListedBanner[] }) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState(banners);
  const [pending, startTransition] = useTransition();

  function fail(e: unknown) {
    toast({ tone: "error", title: "Não foi possível salvar", description: e instanceof ApiError ? e.message : "Tente novamente." });
    setItems(banners);
  }

  function move(index: number, delta: number) {
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item!);
    setItems(next);
    startTransition(async () => {
      try {
        await api("/api/v1/banners/order", { method: "PUT", body: { ids: next.map((b) => b.id) } });
        router.refresh();
      } catch (e) {
        fail(e);
      }
    });
  }

  function toggle(banner: ListedBanner, active: boolean) {
    setItems((list) => list.map((b) => (b.id === banner.id ? { ...b, active } : b)));
    startTransition(async () => {
      try {
        await api(`/api/v1/banners/${banner.id}`, { method: "PUT", body: { ...banner.payload, active } });
        toast({ tone: "success", title: active ? "Banner ativado" : "Banner desativado" });
        router.refresh();
      } catch (e) {
        fail(e);
      }
    });
  }

  return (
    <ol className="space-y-3" aria-label="Banners na ordem do carrossel">
      {items.map((b, i) => {
        const status = STATUS[b.status];
        return (
          <li key={b.id} className={cn("card flex flex-col gap-4 p-4 sm:flex-row sm:items-center", pending && "opacity-80")}>
            <div className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-caption font-bold text-purple-600" aria-label={`Posição ${i + 1}`}>
                {i + 1}
              </span>
              {b.imageFileId ? (
                // eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido pela própria API
                <img src={`/api/v1/files/${b.imageFileId}`} alt="" className="h-16 w-28 shrink-0 rounded-lg object-cover" />
              ) : (
                <CoverArt theme={b.theme} illustration={b.illustration ?? "compass"} className="h-16 w-28 shrink-0 rounded-lg" iconClassName="size-7" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/gestao/comunicacao/banners/${b.id}` as Route} className="font-semibold text-neutral-900 hover:text-purple-600 hover:underline">
                  {b.title}
                </Link>
                <Badge tone={status.tone}>{status.label}</Badge>
              </div>
              {b.subtitle ? <p className="mt-0.5 line-clamp-1 text-body-sm text-neutral-600">{b.subtitle}</p> : null}
              {b.period ? <p className="mt-0.5 text-caption text-neutral-500">{b.period}</p> : null}
            </div>
            <div className="flex items-center gap-1">
              <Switch label={<span className="sr-only">Ativar “{b.title}”</span>} checked={b.active} onCheckedChange={(v) => toggle(b, v === true)} disabled={pending} />
              <IconButton label={`Subir “${b.title}”`} variant="plain" size="sm" disabled={pending || i === 0} onClick={() => move(i, -1)}>
                <ArrowUp />
              </IconButton>
              <IconButton label={`Descer “${b.title}”`} variant="plain" size="sm" disabled={pending || i === items.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown />
              </IconButton>
              <Link
                href={`/gestao/comunicacao/banners/${b.id}` as Route}
                aria-label={`Editar “${b.title}”`}
                title="Editar"
                className="inline-flex size-8 items-center justify-center rounded-full text-neutral-700 hover:bg-purple-50 hover:text-purple-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
              >
                <Pencil aria-hidden className="size-4" />
              </Link>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

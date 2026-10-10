"use client";

import { ArrowDown, ArrowUp, CalendarDays, ExternalLink, GripVertical, MoreVertical, Pencil, Trash2, UsersRound } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/design-system/components/badge";
import { Switch } from "@/design-system/components/choice";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/design-system/components/menu";
import { useToast } from "@/design-system/components/toast";
import { cn } from "@/design-system/cn";
import { COVER_ICONS, type CoverIllustration, type CoverTheme } from "@/design-system/illustrations/cover-art";
import { api, ApiError } from "@/lib/api-client";

export type ListedBanner = {
  id: string;
  layout: "composed" | "image";
  title: string;
  subtitle: string | null;
  theme: CoverTheme;
  illustration: CoverIllustration | null;
  imageFileId: string | null;
  active: boolean;
  status: "live" | "scheduled" | "ended" | "inactive";
  period: string;
  // Campos necessários para salvar a troca de "ativo" sem perder o resto.
  payload: Record<string, unknown>;
};

const STATUS = {
  live: { label: "Ativo", tone: "green" },
  scheduled: { label: "Agendado", tone: "orange" },
  ended: { label: "Encerrado", tone: "neutral" },
  inactive: { label: "Inativo", tone: "neutral" },
} as const;

const BACKGROUND: Record<CoverTheme, string> = {
  purple: "from-purple-50 via-purple-100 to-purple-200",
  green: "from-green-50 via-green-100 to-green-100",
  orange: "from-orange-50 via-orange-100 to-orange-100",
  blue: "from-blue-50 via-blue-100 to-blue-100",
  pink: "from-pink-50 via-pink-100 to-pink-100",
  yellow: "from-yellow-100 via-yellow-100 to-orange-100",
};
const ICON_TONE: Record<CoverTheme, string> = { purple: "text-purple-600", green: "text-green-700", orange: "text-orange-700", blue: "text-blue-700", pink: "text-pink-700", yellow: "text-yellow-700" };

/** Miniatura do banner como aparece na home: a arte enviada ou um resumo do banner montado. */
function Thumbnail({ banner }: { banner: ListedBanner }) {
  const frame = "relative aspect-[16/5] w-full shrink-0 overflow-hidden rounded-lg sm:w-[300px] lg:w-[400px]";
  if (banner.layout === "image" && banner.imageFileId) {
    // eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido pela própria API
    return <img src={`/api/v1/files/${banner.imageFileId}`} alt="" className={cn(frame, "object-cover")} />;
  }
  const Icon = COVER_ICONS[banner.illustration ?? "compass"];
  return (
    <div aria-hidden className={cn(frame, "flex items-center bg-gradient-to-br", BACKGROUND[banner.theme])}>
      <p className="line-clamp-3 max-w-[60%] pl-5 text-body-sm font-extrabold leading-tight text-neutral-900 lg:text-h4">{banner.title}</p>
      {banner.imageFileId ? (
        // eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido pela própria API
        <img src={`/api/v1/files/${banner.imageFileId}`} alt="" className="absolute inset-y-0 right-0 h-full w-[38%] object-cover" />
      ) : (
        <Icon className={cn("absolute right-6 size-12 lg:size-14", ICON_TONE[banner.theme])} />
      )}
    </div>
  );
}

/** Lista de banners: arrastar (ou setas) para ordenar o carrossel, ativar/desativar, editar e excluir. */
export function BannerList({ banners }: { banners: ListedBanner[] }) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState(banners);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function fail(e: unknown) {
    toast({ tone: "error", title: "Não foi possível salvar", description: e instanceof ApiError ? e.message : "Tente novamente." });
    setItems(banners);
  }

  function saveOrder(next: ListedBanner[]) {
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

  function moveTo(from: number, to: number) {
    if (from === to || to < 0 || to >= items.length) return;
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    saveOrder(next);
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

  function remove(banner: ListedBanner) {
    if (!window.confirm(`Excluir o banner “${banner.title}”? Ele sai da home imediatamente.`)) return;
    startTransition(async () => {
      try {
        await api(`/api/v1/banners/${banner.id}`, { method: "DELETE" });
        setItems((list) => list.filter((b) => b.id !== banner.id));
        toast({ tone: "success", title: "Banner excluído" });
        router.refresh();
      } catch (e) {
        fail(e);
      }
    });
  }

  return (
    <ol className="space-y-4" aria-label="Banners na ordem do carrossel">
      {items.map((b, i) => {
        const status = STATUS[b.status];
        const edit = `/gestao/comunicacao/banners/${b.id}` as Route;
        return (
          <li
            key={b.id}
            draggable={!pending}
            onDragStart={(e) => {
              setDragging(b.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              if (!dragging) return;
              e.preventDefault();
              setOver(b.id);
            }}
            onDragLeave={() => setOver((o) => (o === b.id ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              const from = items.findIndex((x) => x.id === dragging);
              setDragging(null);
              setOver(null);
              if (from !== -1) moveTo(from, i);
            }}
            onDragEnd={() => {
              setDragging(null);
              setOver(null);
            }}
            className={cn(
              "card flex flex-col gap-4 p-4 transition-shadow sm:flex-row sm:items-center sm:gap-5 sm:p-5",
              pending && "opacity-80",
              dragging === b.id && "opacity-50",
              over === b.id && dragging !== b.id && "ring-2 ring-purple-300",
            )}
          >
            <div className="flex items-center gap-3">
              <span aria-hidden title="Arraste para reorganizar" className="cursor-grab text-neutral-400 active:cursor-grabbing">
                <GripVertical className="size-5" />
              </span>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-purple-50 text-body-sm font-bold text-purple-600" aria-label={`Posição ${i + 1}`}>
                {i + 1}
              </span>
            </div>
            <Thumbnail banner={b} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={edit} className="text-h4 font-bold text-neutral-900 hover:text-purple-600 hover:underline">
                  {b.title}
                </Link>
                <Badge tone={status.tone}>{status.label}</Badge>
              </div>
              {b.subtitle ? <p className="mt-1 line-clamp-1 break-all text-body-sm text-neutral-600">{b.subtitle}</p> : null}
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-body-sm text-neutral-600">
                <span className="inline-flex items-center gap-2">
                  <UsersRound aria-hidden className="size-4" /> Toda a empresa
                </span>
                <span className="inline-flex items-center gap-2">
                  <CalendarDays aria-hidden className="size-4" /> {b.period}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 self-end sm:self-center">
              <Switch label={<span className="sr-only">Ativar “{b.title}”</span>} checked={b.active} onCheckedChange={(v) => toggle(b, v === true)} disabled={pending} />
              <span aria-hidden className="mx-3 h-8 w-px bg-line" />
              <RowButton label={`Subir “${b.title}”`} disabled={pending || i === 0} onClick={() => moveTo(i, i - 1)}>
                <ArrowUp />
              </RowButton>
              <RowButton label={`Descer “${b.title}”`} disabled={pending || i === items.length - 1} onClick={() => moveTo(i, i + 1)}>
                <ArrowDown />
              </RowButton>
              <Link
                href={edit}
                aria-label={`Editar “${b.title}”`}
                title="Editar"
                className="inline-flex size-9 items-center justify-center rounded-full text-neutral-800 hover:bg-purple-50 hover:text-purple-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
              >
                <Pencil aria-hidden className="size-[18px]" />
              </Link>
              <Menu>
                <MenuTrigger asChild>
                  <button type="button" aria-label={`Mais ações de “${b.title}”`} className="inline-flex size-9 items-center justify-center rounded-full text-neutral-800 hover:bg-purple-50 hover:text-purple-600 focus-visible:outline-2 focus-visible:outline-purple-500">
                    <MoreVertical aria-hidden className="size-[18px]" />
                  </button>
                </MenuTrigger>
                <MenuContent>
                  <MenuItem asChild>
                    <Link href={edit}>
                      <Pencil aria-hidden /> Editar
                    </Link>
                  </MenuItem>
                  {b.status === "live" ? (
                    <MenuItem asChild>
                      <Link href="/inicio">
                        <ExternalLink aria-hidden /> Ver na home
                      </Link>
                    </MenuItem>
                  ) : null}
                  <MenuSeparator />
                  <MenuItem onSelect={() => remove(b)} className="text-red-600 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-600">
                    <Trash2 aria-hidden /> Excluir
                  </MenuItem>
                </MenuContent>
              </Menu>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function RowButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-9 items-center justify-center rounded-full text-neutral-800 hover:bg-purple-50 hover:text-purple-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500 disabled:text-neutral-300 disabled:hover:bg-transparent [&_svg]:size-[18px]"
    >
      {children}
    </button>
  );
}

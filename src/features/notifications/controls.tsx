"use client";

import { Check, Filter, Settings } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/design-system/components/button";
import { Switch } from "@/design-system/components/choice";
import { Modal } from "@/design-system/components/dialog";
import { useToast } from "@/design-system/components/toast";
import { cn } from "@/design-system/cn";
import { api } from "@/lib/api-client";
import { CATEGORY, CATEGORY_ORDER, type NotificationCategory } from "./labels";

/** "Marcar todas como lidas". */
export function MarkAllReadButton({ disabled, className }: { disabled?: boolean; className?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={disabled || pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await api("/api/v1/me/notifications/read-all", { method: "POST" });
            toast({ tone: "success", title: "Tudo em dia! Todas as notificações foram marcadas como lidas." });
            router.refresh();
          } catch {
            toast({ tone: "error", title: "Não foi possível marcar as notificações como lidas." });
          }
        })
      }
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md text-body-sm font-semibold text-purple-600 hover:text-purple-700 hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500 disabled:pointer-events-none disabled:text-neutral-500",
        className,
      )}
    >
      <Check aria-hidden className="size-4" /> Marcar todas como lidas
    </button>
  );
}

/** Filtro por categoria (estado na URL, preservando a aba). */
export function CategoryFilters({ selected, tab }: { selected: NotificationCategory[] | null; tab: string }) {
  const router = useRouter();
  const active = new Set(selected ?? CATEGORY_ORDER);
  const all = active.size === CATEGORY_ORDER.length;

  function apply(next: Set<NotificationCategory>) {
    const query = new URLSearchParams();
    if (tab !== "todas") query.set("aba", tab);
    if (next.size !== CATEGORY_ORDER.length) query.set("tipos", CATEGORY_ORDER.filter((c) => next.has(c)).join(",") || "nenhum");
    const qs = query.toString();
    router.push(`/notificacoes${qs ? `?${qs}` : ""}` as Route, { scroll: false });
  }

  const box = (checked: boolean) =>
    cn("flex size-5 shrink-0 items-center justify-center rounded-sm border-2", checked ? "border-purple-500 bg-purple-500 text-white" : "border-neutral-300 bg-white");

  return (
    <section aria-labelledby="filtros-notificacoes" className="card p-5">
      <h2 id="filtros-notificacoes" className="mb-4 flex items-center gap-2 text-h4 font-bold text-neutral-900">
        <Filter aria-hidden className="size-5 text-neutral-700" /> Filtros
      </h2>
      <ul className="space-y-3">
        <li>
          <label className="flex cursor-pointer items-center gap-3 text-body-sm text-neutral-800">
            <input type="checkbox" className="peer sr-only" checked={all} onChange={() => apply(new Set(all ? [] : CATEGORY_ORDER))} />
            <span aria-hidden className={cn(box(all), "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-purple-500")}>
              {all ? <Check className="size-3.5" strokeWidth={3} /> : null}
            </span>
            Todas as notificações
          </label>
        </li>
        {CATEGORY_ORDER.map((c) => {
          const { icon: Icon, tile, label, filled } = CATEGORY[c];
          const checked = active.has(c);
          return (
            <li key={c}>
              <label className="flex cursor-pointer items-center gap-3 text-body-sm text-neutral-800">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={checked}
                  onChange={() => {
                    const next = new Set(active);
                    if (checked) next.delete(c);
                    else next.add(c);
                    apply(next);
                  }}
                />
                <span aria-hidden className={cn(box(checked), "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-purple-500")}>
                  {checked ? <Check className="size-3.5" strokeWidth={3} /> : null}
                </span>
                <span aria-hidden className={cn("flex size-7 items-center justify-center rounded-md", tile)}>
                  <Icon className={cn("size-4", filled && "fill-current")} />
                </span>
                {label}
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Janela de preferências: quais categorias aparecem (e contam) para a pessoa. */
export function PreferencesDialog({ open, onOpenChange, muted }: { open: boolean; onOpenChange: (open: boolean) => void; muted: NotificationCategory[] }) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState(new Set(muted));
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      try {
        await api("/api/v1/me/notifications/preferences", { method: "PUT", body: { muted: [...value] } });
        toast({ tone: "success", title: "Preferências salvas" });
        onOpenChange(false);
        router.refresh();
      } catch {
        toast({ tone: "error", title: "Não foi possível salvar as preferências." });
      }
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Preferências de notificação"
      description="Escolha o que aparece no sino e na central de notificações."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={save} loading={pending}>
            Salvar preferências
          </Button>
        </>
      }
    >
      <ul className="divide-y divide-line">
        {CATEGORY_ORDER.map((c) => {
          const { icon: Icon, tile, label, filled } = CATEGORY[c];
          return (
            <li key={c} className="flex items-center gap-3 py-3">
              <span aria-hidden className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", tile)}>
                <Icon className={cn("size-[18px]", filled && "fill-current")} />
              </span>
              <span className="flex-1 text-body-sm font-medium text-neutral-800">{label}</span>
              <Switch
                label={<span className="sr-only">Receber notificações de {label.toLowerCase()}</span>}
                checked={!value.has(c)}
                onCheckedChange={(on) =>
                  setValue((v) => {
                    const next = new Set(v);
                    if (on === true) next.delete(c);
                    else next.add(c);
                    return next;
                  })
                }
              />
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

/** Card "Preferências de notificação" da central. */
export function PreferencesCard({ muted }: { muted: NotificationCategory[] }) {
  const [open, setOpen] = useState(false);
  return (
    <section aria-labelledby="preferencias-notificacao" className="card p-5">
      <h2 id="preferencias-notificacao" className="flex items-center gap-2 text-h4 font-bold text-neutral-900">
        <Settings aria-hidden className="size-5 text-neutral-700" /> Preferências de notificação
      </h2>
      <p className="mt-2 text-body-sm text-neutral-600">Gerencie quais notificações você deseja receber.</p>
      {muted.length ? (
        <p className="mt-2 text-caption text-neutral-600">
          Desativadas: {muted.map((c) => CATEGORY[c].label.toLowerCase()).join(", ")}.
        </p>
      ) : null}
      <Button variant="ghost" className="mt-4 w-full text-purple-600" onClick={() => setOpen(true)}>
        Configurar preferências
      </Button>
      {/* Recriada a cada abertura: começa sempre do que está salvo. */}
      <PreferencesDialog key={String(open)} open={open} onOpenChange={setOpen} muted={muted} />
    </section>
  );
}

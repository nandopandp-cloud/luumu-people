"use client";

import { ArrowDown, ArrowUp, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, IconButton } from "@/design-system/components/button";
import { Switch } from "@/design-system/components/choice";
import { Modal } from "@/design-system/components/dialog";
import { Alert } from "@/design-system/components/feedback";
import { Field, Input } from "@/design-system/components/field";
import { Select } from "@/design-system/components/select";
import { useToast } from "@/design-system/components/toast";
import { cn } from "@/design-system/cn";
import { QUICK_LINK_COLOR, QUICK_LINK_ICON } from "@/features/announcements/mural/labels";
import { api, ApiError } from "@/lib/api-client";

export type ManagedQuickLink = { id: string; label: string; url: string; icon: string; color: string; active: boolean };
type Draft = Omit<ManagedQuickLink, "id"> & { id?: string };

const EMPTY: Draft = { label: "", url: "", icon: "link", color: "purple", active: true };

function Tile({ icon, color, className }: { icon: string; color: string; className?: string }) {
  const Icon = (QUICK_LINK_ICON[icon] ?? QUICK_LINK_ICON.link!).icon;
  return (
    <span aria-hidden className={cn("flex size-12 shrink-0 items-center justify-center rounded-lg", (QUICK_LINK_COLOR[color] ?? QUICK_LINK_COLOR.purple!).tile, className)}>
      <Icon className="size-5" />
    </span>
  );
}

/** Gestão dos links rápidos do mural: criar, editar, ordenar, ativar e excluir. */
export function QuickLinkManager({ links }: { links: ManagedQuickLink[] }) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState(links);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const payload = (l: Draft) => ({ label: l.label, url: l.url, icon: l.icon, color: l.color, active: l.active });

  function fail(e: unknown) {
    toast({ tone: "error", title: "Não foi possível salvar", description: e instanceof ApiError ? e.message : "Tente novamente." });
    setItems(links);
  }

  function move(index: number, delta: number) {
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item!);
    setItems(next);
    startTransition(async () => {
      try {
        await api("/api/v1/quick-links/order", { method: "PUT", body: { ids: next.map((l) => l.id) } });
        router.refresh();
      } catch (e) {
        fail(e);
      }
    });
  }

  function toggle(link: ManagedQuickLink, active: boolean) {
    setItems((list) => list.map((l) => (l.id === link.id ? { ...l, active } : l)));
    startTransition(async () => {
      try {
        await api(`/api/v1/quick-links/${link.id}`, { method: "PUT", body: payload({ ...link, active }) });
        router.refresh();
      } catch (e) {
        fail(e);
      }
    });
  }

  function remove(link: ManagedQuickLink) {
    if (!window.confirm(`Excluir o link “${link.label}”?`)) return;
    startTransition(async () => {
      try {
        await api(`/api/v1/quick-links/${link.id}`, { method: "DELETE" });
        setItems((list) => list.filter((l) => l.id !== link.id));
        toast({ tone: "success", title: "Link excluído" });
        router.refresh();
      } catch (e) {
        fail(e);
      }
    });
  }

  function save() {
    if (!draft) return;
    setError(null);
    setErrors({});
    startTransition(async () => {
      try {
        if (draft.id) await api(`/api/v1/quick-links/${draft.id}`, { method: "PUT", body: payload(draft) });
        else await api("/api/v1/quick-links", { method: "POST", body: payload(draft) });
        toast({ tone: "success", title: draft.id ? "Link atualizado" : "Link criado" });
        setDraft(null);
        router.refresh();
      } catch (e) {
        if (e instanceof ApiError) {
          setErrors(Object.fromEntries(e.fieldErrors.map((f) => [f.path, f.message])));
          setError(e.fieldErrors[0]?.message ?? e.message);
        } else setError("Não foi possível salvar. Tente novamente.");
      }
    });
  }

  const open = (link: Draft) => {
    setErrors({});
    setError(null);
    setDraft(link);
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => open(EMPTY)}>
          <Plus aria-hidden /> Novo link
        </Button>
      </div>
      {items.length === 0 ? (
        <div className="card p-6 text-center text-body-sm text-neutral-600">Nenhum link criado. Os links aparecem no mural de comunicados, em “Links rápidos”.</div>
      ) : (
        <ol className="space-y-3" aria-label="Links rápidos na ordem do mural">
          {items.map((l, i) => (
            <li key={l.id} className={cn("card flex flex-wrap items-center gap-4 p-4", pending && "opacity-80")}>
              <Tile icon={l.icon} color={l.color} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-neutral-900">{l.label}</p>
                <p className="flex items-center gap-1 truncate text-body-sm text-neutral-600">
                  {l.url.startsWith("https://") ? <ExternalLink aria-hidden className="size-3.5 shrink-0" /> : null}
                  {l.url}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Switch label={<span className="sr-only">Exibir “{l.label}” no mural</span>} checked={l.active} onCheckedChange={(v) => toggle(l, v === true)} disabled={pending} />
                <IconButton label={`Subir “${l.label}”`} variant="plain" size="sm" disabled={pending || i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp />
                </IconButton>
                <IconButton label={`Descer “${l.label}”`} variant="plain" size="sm" disabled={pending || i === items.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown />
                </IconButton>
                <IconButton label={`Editar “${l.label}”`} variant="plain" size="sm" onClick={() => open(l)}>
                  <Pencil />
                </IconButton>
                <IconButton label={`Excluir “${l.label}”`} variant="plain" size="sm" onClick={() => remove(l)} disabled={pending}>
                  <Trash2 />
                </IconButton>
              </div>
            </li>
          ))}
        </ol>
      )}

      <Modal
        open={draft !== null}
        onOpenChange={(o) => {
          if (!o) setDraft(null);
        }}
        title={draft?.id ? "Editar link rápido" : "Novo link rápido"}
        description="Aparece no mural de comunicados, na ordem definida aqui."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft(null)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={save} loading={pending}>
              Salvar
            </Button>
          </>
        }
      >
        {draft ? (
          <div className="space-y-4">
            {error ? <Alert tone="error" title={error} /> : null}
            <div className="flex items-center gap-3 rounded-lg bg-neutral-50 p-3">
              <Tile icon={draft.icon} color={draft.color} />
              <span className="text-body-sm font-medium text-neutral-800">{draft.label || "Prévia"}</span>
            </div>
            <Field label="Nome" hint="Até 24 caracteres." error={errors.label}>
              {(f) => <Input id={f.id} aria-describedby={f.describedBy} invalid={f.invalid} value={draft.label} maxLength={24} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />}
            </Field>
            <Field label="Destino" hint="Página da plataforma (ex.: /comunicados) ou endereço https://." error={errors.url}>
              {(f) => <Input id={f.id} aria-describedby={f.describedBy} invalid={f.invalid} value={draft.url} maxLength={500} placeholder="https://" onChange={(e) => setDraft({ ...draft, url: e.target.value })} />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Ícone">
                {(f) => (
                  <Select id={f.id} value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })}>
                    {Object.entries(QUICK_LINK_ICON).map(([value, i]) => (
                      <option key={value} value={value}>
                        {i.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Cor">
                {(f) => (
                  <Select id={f.id} value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })}>
                    {Object.entries(QUICK_LINK_COLOR).map(([value, c]) => (
                      <option key={value} value={value}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <Switch label="Exibir no mural" checked={draft.active} onCheckedChange={(v) => setDraft({ ...draft, active: v === true })} />
          </div>
        ) : null}
      </Modal>
    </>
  );
}

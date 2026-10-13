"use client";

import { Check, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button } from "@/design-system/components/button";
import { Modal } from "@/design-system/components/dialog";
import { useToast } from "@/design-system/components/toast";
import { cn } from "@/design-system/cn";
import { api, ApiError } from "@/lib/api-client";
import { INTERESTS, MAX_INTERESTS } from "@/lib/interests";
import { InterestGlyph, TONE } from "./interest-icon";

/** Escolha dos interesses do próprio perfil (até MAX_INTERESTS), usados nas afinidades de Conexões. */
export function InterestsDialog({
  initial,
  trigger,
  open: controlledOpen,
  onOpenChange,
  onSaved,
}: {
  initial: string[];
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSaved?: (keys: string[]) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlledOpen ?? innerOpen;
  const setOpen = (value: boolean) => {
    onOpenChange?.(value);
    setInnerOpen(value);
  };
  const [selected, setSelected] = useState<string[]>(initial);
  // Ao abrir (por gatilho ou pelo pai), começa dos interesses atuais.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSelected(initial);
  }
  const [saving, setSaving] = useState(false);
  const toggle = (key: string) =>
    setSelected((list) => (list.includes(key) ? list.filter((k) => k !== key) : list.length >= MAX_INTERESTS ? list : [...list, key]));

  async function save() {
    setSaving(true);
    try {
      const { keys } = await api<{ keys: string[] }>("/api/v1/me/interests", { method: "PUT", body: { keys: selected } });
      toast({ tone: "success", title: "Interesses salvos.", description: "Eles ajudam a encontrar pessoas com afinidades com você." });
      setOpen(false);
      onSaved?.(keys);
      router.refresh();
    } catch (error) {
      toast({ tone: "error", title: "Não foi possível salvar.", description: error instanceof ApiError ? error.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      size="lg"
      title="Meus interesses"
      description={`Escolha até ${MAX_INTERESTS}. Eles aparecem no seu perfil e mostram afinidades com colegas.`}
      footer={
        <>
          <span className="mr-auto self-center text-caption text-neutral-600">
            {selected.length} de {MAX_INTERESTS}
          </span>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={save} loading={saving}>
            <Sparkles aria-hidden /> Salvar interesses
          </Button>
        </>
      }
    >
      <ul className="flex flex-wrap gap-2" aria-label="Interesses">
        {INTERESTS.map((i) => {
          const on = selected.includes(i.key);
          const full = !on && selected.length >= MAX_INTERESTS;
          return (
            <li key={i.key}>
              <button
                type="button"
                aria-pressed={on}
                disabled={full}
                onClick={() => toggle(i.key)}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-full border pl-1.5 pr-3.5 text-body-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500 disabled:opacity-50",
                  on ? "border-purple-500 bg-purple-50 text-purple-700" : "border-line bg-white text-neutral-700 hover:border-purple-200 hover:bg-purple-50",
                )}
              >
                <span aria-hidden className={cn("flex size-7 items-center justify-center rounded-full", TONE[i.tone])}>
                  {on ? <Check className="size-4" /> : <InterestGlyph interest={i.key} className="size-4" />}
                </span>
                {i.label}
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

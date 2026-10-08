"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/design-system/components/button";
import { Modal } from "@/design-system/components/dialog";
import { Alert } from "@/design-system/components/feedback";
import { Field, Input, Textarea } from "@/design-system/components/field";
import { api, ApiError } from "@/lib/api-client";

type Editable = "preferredName" | "phone" | "headline";

const LABELS: Record<Editable, string> = {
  preferredName: "Como prefere ser chamado(a)",
  phone: "Telefone",
  headline: "Frase do perfil",
};

export function EditProfileDialog({ editable, initial }: { editable: string[]; initial: Partial<Record<Editable, string | null>> }) {
  const fields = (["preferredName", "phone", "headline"] as const).filter((f) => editable.includes(f));
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f, initial[f] ?? ""])) as Record<Editable, string>);
  const [error, setError] = useState<ApiError | null>(null);
  const [pending, startTransition] = useTransition();

  if (fields.length === 0) return null;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const body = Object.fromEntries(fields.map((f) => [f, values[f].trim() === "" ? null : values[f].trim()]));
        await api("/api/v1/me/profile", { method: "PATCH", body });
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof ApiError ? e : new ApiError(0, "Algo deu errado. Tente novamente."));
      }
    });
  }

  const fieldError = (f: Editable) => error?.fieldErrors.find((e) => e.path === f)?.message;

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
      title="Editar perfil"
      description="Você pode editar os campos que a sua empresa liberou. Os demais dados são atualizados pelo time de Gente & Gestão."
      trigger={
        <Button variant="tertiary" size="sm">
          <Pencil aria-hidden /> Editar
        </Button>
      }
    >
      <form id="edit-profile" onSubmit={submit} className="space-y-5" noValidate>
        {error && error.fieldErrors.length === 0 ? (
          <Alert tone="error" title="Não foi possível salvar">
            {error.message}
          </Alert>
        ) : null}
        {fields.map((f) => (
          <Field key={f} label={LABELS[f]} error={fieldError(f)} hint={f === "headline" ? "Até 160 caracteres." : undefined}>
            {({ id, describedBy, invalid }) =>
              f === "headline" ? (
                <Textarea id={id} aria-describedby={describedBy} invalid={invalid} maxLength={160} value={values[f]} onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))} />
              ) : (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  type={f === "phone" ? "tel" : "text"}
                  autoComplete={f === "phone" ? "tel" : "nickname"}
                  value={values[f]}
                  onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))}
                />
              )
            }
          </Field>
        ))}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" loading={pending}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

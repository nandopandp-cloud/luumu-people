"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/design-system/components/button";
import { Modal } from "@/design-system/components/dialog";
import { Alert } from "@/design-system/components/feedback";
import { Field, Input, Textarea } from "@/design-system/components/field";
import { Select } from "@/design-system/components/select";
import { useToast } from "@/design-system/components/toast";
import { api, ApiError } from "@/lib/api-client";
import { CATEGORY_LABEL } from "./labels";

export function NewCompetencyButton() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("comportamental");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Nova competência"
      description="Ela passa a valer para toda a empresa, com nível esperado padrão de 70%."
      trigger={
        <Button>
          <Plus aria-hidden /> Nova competência
        </Button>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            try {
              await api("/api/v1/development/competencies", { method: "POST", body: { name, category, description: description.trim() || null } });
              setOpen(false);
              setName("");
              setDescription("");
              router.refresh();
              toast({ tone: "success", title: "Competência criada!" });
            } catch (err) {
              setError(err instanceof ApiError ? err.message : "Não foi possível criar.");
            }
          });
        }}
      >
        {error ? <Alert tone="error" title={error} /> : null}
        <Field label="Nome">{({ id }) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />}</Field>
        <Field label="Categoria">
          {({ id }) => (
            <Select id={id} value={category} onChange={(e) => setCategory(e.target.value)}>
              {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Descrição">{({ id }) => <Textarea id={id} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />}</Field>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" loading={pending}>
            Criar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

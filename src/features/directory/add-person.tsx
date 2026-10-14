"use client";

import { Mail, UserPlus } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/design-system/components/button";
import { Switch } from "@/design-system/components/choice";
import { Combobox } from "@/design-system/components/combobox";
import { DatePicker } from "@/design-system/components/date-picker";
import { Modal } from "@/design-system/components/dialog";
import { Alert } from "@/design-system/components/feedback";
import { Field, Input } from "@/design-system/components/field";
import { Select } from "@/design-system/components/select";
import { useToast } from "@/design-system/components/toast";
import { api, ApiError } from "@/lib/api-client";
import { CONTRACT_LABELS } from "@/lib/format";

type Option = { id: string; name: string };
export type AddPersonOptions = {
  orgUnits: (Option & { type: string })[];
  positions: Option[];
  businessUnits: Option[];
  jobLevels: Option[];
  managers: (Option & { image: string | null })[];
};

const EMPTY = { name: "", email: "", hireDate: null as string | null, orgUnitId: "", positionId: "", businessUnitId: "", jobLevelId: "", managerId: "", contractType: "clt", sendInvite: true };

/** "Adicionar colaborador": cadastro com lotação, gestor(a) e convite de acesso por e-mail. */
export function AddPersonButton({ options }: { options: AddPersonOptions }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const emailInvalid = form.email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const ready = form.name.trim().length >= 3 && form.email && !emailInvalid && form.hireDate && form.orgUnitId && form.positionId;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await api<{ id: string; invited: boolean }>("/api/v1/people", {
          method: "POST",
          body: {
            name: form.name.trim(),
            email: form.email.trim(),
            hireDate: form.hireDate,
            orgUnitId: form.orgUnitId,
            positionId: form.positionId,
            businessUnitId: form.businessUnitId || null,
            jobLevelId: form.jobLevelId || null,
            managerId: form.managerId || null,
            contractType: form.contractType,
            sendInvite: form.sendInvite,
          },
        });
        const first = form.name.trim().split(" ")[0];
        setOpen(false);
        setForm(EMPTY);
        if (form.sendInvite && !result.invited) {
          toast({ tone: "warning", title: `${first} foi cadastrado(a), mas o convite não foi enviado.`, description: "Use “Reenviar convite” nas ações da pessoa." });
        } else {
          toast({ tone: "success", title: form.sendInvite ? `Convite enviado para ${first}!` : `${first} foi cadastrado(a).`, description: form.sendInvite ? "O link para criar a senha vale por 7 dias." : "Envie o convite quando quiser, pelas ações da pessoa." });
        }
        router.push("/gestao/colaboradores?status=pendentes" as Route);
        router.refresh();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Não foi possível cadastrar. Tente novamente.");
      }
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setError(null);
      }}
      size="lg"
      title="Adicionar colaborador"
      description="A pessoa entra como convidada e ganha acesso ao criar a própria senha."
      trigger={
        <Button size="lg" className="shadow-[0_10px_24px_-10px_rgb(124_58_237/0.7)]">
          <UserPlus aria-hidden /> Adicionar colaborador
        </Button>
      }
    >
      <form id="novo-colaborador" onSubmit={submit} className="space-y-5" noValidate>
        {error ? <Alert tone="error" title={error} /> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome completo" className="sm:col-span-2">
            {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} value={form.name} onChange={(e) => set("name", e.target.value)} required minLength={3} maxLength={120} autoComplete="off" />}
          </Field>
          <Field label="E-mail corporativo" hint="O convite chega neste e-mail." error={emailInvalid ? "Informe um e-mail válido." : null}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} aria-describedby={describedBy} invalid={invalid} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required leading={<Mail />} autoComplete="off" />
            )}
          </Field>
          <Field label="Data de admissão">{({ id, describedBy }) => <DatePicker id={id} aria-describedby={describedBy} value={form.hireDate} onChange={(v) => set("hireDate", v)} />}</Field>
          <Field label="Área">
            {({ id }) => (
              <Select id={id} value={form.orgUnitId} onChange={(e) => set("orgUnitId", e.target.value)} required>
                <option value="">Selecione</option>
                {options.orgUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.type === "directorate" ? u.name : `— ${u.name}`}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Cargo">
            {({ id }) => (
              <Select id={id} value={form.positionId} onChange={(e) => set("positionId", e.target.value)} required>
                <option value="">Selecione</option>
                {options.positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Unidade (opcional)">
            {({ id }) => (
              <Select id={id} value={form.businessUnitId} onChange={(e) => set("businessUnitId", e.target.value)}>
                <option value="">Sem unidade</option>
                {options.businessUnits.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Nível (opcional)">
            {({ id }) => (
              <Select id={id} value={form.jobLevelId} onChange={(e) => set("jobLevelId", e.target.value)}>
                <option value="">Sem nível</option>
                {options.jobLevels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Gestor(a) (opcional)">
            {({ id, describedBy }) => (
              <Combobox
                id={id}
                aria-describedby={describedBy}
                placeholder="Sem gestor(a)"
                searchPlaceholder="Buscar pessoa…"
                options={options.managers.map((m) => ({ value: m.id, label: m.name, avatar: { name: m.name, src: m.image } }))}
                value={form.managerId ? [form.managerId] : []}
                onChange={(v) => set("managerId", v.at(-1) ?? "")}
              />
            )}
          </Field>
          <Field label="Tipo de contrato">
            {({ id }) => (
              <Select id={id} value={form.contractType} onChange={(e) => set("contractType", e.target.value)}>
                {Object.entries(CONTRACT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <div className="rounded-lg bg-purple-50 px-4 py-3">
          <Switch label="Enviar o convite por e-mail agora" checked={form.sendInvite} onCheckedChange={(v) => set("sendInvite", v)} />
          <p className="mt-1.5 pl-14 text-caption text-neutral-600">O link para criar a senha vale por 7 dias. Se preferir, envie depois pelas ações da pessoa.</p>
        </div>
        <div className="flex justify-end gap-3 border-t border-line pt-4">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" loading={pending} disabled={!ready}>
            {form.sendInvite ? "Cadastrar e convidar" : "Cadastrar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

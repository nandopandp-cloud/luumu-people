"use client";

import { Mail, Pencil, Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/design-system/components/button";
import { Combobox } from "@/design-system/components/combobox";
import { DatePicker } from "@/design-system/components/date-picker";
import { Modal } from "@/design-system/components/dialog";
import { Alert } from "@/design-system/components/feedback";
import { Field, Input } from "@/design-system/components/field";
import { Select } from "@/design-system/components/select";
import { useToast } from "@/design-system/components/toast";
import { api, ApiError } from "@/lib/api-client";
import { CONTRACT_LABELS, formatLocation } from "@/lib/format";
import { JOB_LEVEL_NAMES, POSITION_NAMES } from "@/lib/job-catalog";

type Option = { id: string; name: string };
export type EditPersonOptions = {
  orgUnits: (Option & { type: string })[];
  positions: Option[];
  jobLevels: Option[];
  locations: (Option & { city: string | null; state: string | null })[];
  managers: (Option & { image: string | null })[];
};
export type EditablePerson = {
  id: string;
  name: string;
  email: string;
  preferredName: string | null;
  hireDate: string | null;
  employeeCode: string | null;
  contractType: string | null;
  employmentStatus: string | null;
  phone: string | null;
  orgUnitId: string | null;
  positionId: string | null;
  jobLevelId: string | null;
  businessUnitId: string | null;
  managerId: string | null;
};

const EMPLOYMENT_LABELS: Record<string, string> = { active: "Em atividade", on_leave: "Afastado(a)", terminated: "Desligado(a)" };
const NEW_LOCATION = "nova";

/** Valor dos selects de cargo/nível: um já cadastrado na empresa (id) ou um da lista fixa (nome). */
const byId = (id: string) => `id:${id}`;
const byName = (name: string) => `fixo:${name}`;

function initialForm(p: EditablePerson) {
  return {
    name: p.name,
    preferredName: p.preferredName ?? "",
    email: p.email,
    hireDate: p.hireDate,
    orgUnitId: p.orgUnitId ?? "",
    position: p.positionId ? byId(p.positionId) : "",
    jobLevel: p.jobLevelId ? byId(p.jobLevelId) : "",
    managerId: p.managerId ?? "",
    location: p.businessUnitId ?? "",
    city: "",
    state: "",
    employeeCode: p.employeeCode ?? "",
    contractType: p.contractType ?? "clt",
    employmentStatus: p.employmentStatus ?? "active",
    phone: p.phone ?? "",
  };
}
type Form = ReturnType<typeof initialForm>;

/** Só os campos que mudaram, no formato da API (PATCH /api/v1/people/:id). */
function diff(before: Form, after: Form): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const text = (v: string) => v.trim();
  const nullable = (v: string) => text(v) || null;
  if (text(after.name) !== text(before.name)) body.name = text(after.name);
  if (text(after.email).toLowerCase() !== text(before.email).toLowerCase()) body.email = text(after.email);
  if (nullable(after.preferredName) !== nullable(before.preferredName)) body.preferredName = nullable(after.preferredName);
  if (after.hireDate && after.hireDate !== before.hireDate) body.hireDate = after.hireDate;
  if (after.orgUnitId && after.orgUnitId !== before.orgUnitId) body.orgUnitId = after.orgUnitId;
  if (after.position && after.position !== before.position) {
    if (after.position.startsWith("id:")) body.positionId = after.position.slice(3);
    else body.position = after.position.slice(5);
  }
  if (after.jobLevel && after.jobLevel !== before.jobLevel) {
    if (after.jobLevel.startsWith("id:")) body.jobLevelId = after.jobLevel.slice(3);
    else body.jobLevel = after.jobLevel.slice(5);
  }
  if (after.managerId !== before.managerId) body.managerId = after.managerId || null;
  if (after.location === NEW_LOCATION) body.location = { city: text(after.city), state: text(after.state).toUpperCase() };
  else if (after.location !== before.location) body.location = after.location ? { businessUnitId: after.location } : null;
  if (nullable(after.employeeCode) !== nullable(before.employeeCode)) body.employeeCode = nullable(after.employeeCode);
  if (after.contractType !== before.contractType) body.contractType = after.contractType;
  if (after.employmentStatus !== before.employmentStatus) body.employmentStatus = after.employmentStatus;
  if (nullable(after.phone) !== nullable(before.phone)) body.phone = nullable(after.phone);
  return body;
}

/**
 * "Editar dados" (people.manage): dados profissionais e de RH do colaborador.
 * Área, cargo, nível, localização e gestor(a) entram no histórico a partir de hoje.
 */
export function EditPersonButton({ person, options, isSelf }: { person: EditablePerson; options: EditPersonOptions; isSelf: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => initialForm(person));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const tenantPositions = new Set(options.positions.map((p) => p.name));
  const tenantLevels = new Set(options.jobLevels.map((l) => l.name));
  const emailInvalid = form.email.trim().length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const phoneInvalid = form.phone.trim().length > 0 && !/^[+()\d\s-]{8,20}$/.test(form.phone.trim());
  const newLocation = form.location === NEW_LOCATION;
  const stateInvalid = newLocation && form.state.trim().length > 0 && !/^[A-Za-z]{2}$/.test(form.state.trim());
  const locationIncomplete = newLocation && (form.city.trim().length < 2 || !/^[A-Za-z]{2}$/.test(form.state.trim()));
  const changes = diff(initialForm(person), form);
  const emailChanging = "email" in changes;
  const ready = Object.keys(changes).length > 0 && form.name.trim().length >= 3 && !emailInvalid && !phoneInvalid && !locationIncomplete;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setError(null);
    startTransition(async () => {
      try {
        await api(`/api/v1/people/${person.id}`, { method: "PATCH", body: changes });
        setOpen(false);
        toast({ tone: "success", title: "Dados atualizados", description: emailChanging ? "A pessoa passa a entrar com o novo e-mail; as sessões abertas foram encerradas." : undefined });
        router.refresh();
      } catch (err) {
        setError(err instanceof ApiError ? [err.message, ...err.fieldErrors.map((f) => f.message)].filter((m, i, all) => all.indexOf(m) === i).join(" ") : "Não foi possível salvar. Tente novamente.");
      }
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setForm(initialForm(person));
        setError(null);
      }}
      size="lg"
      title="Editar dados"
      description="Mudanças de área, cargo, nível, localização e gestor(a) valem a partir de hoje e ficam no histórico."
      trigger={
        <Button variant="secondary">
          <Pencil aria-hidden /> Editar dados
        </Button>
      }
    >
      <form onSubmit={submit} className="space-y-6" noValidate>
        {error ? <Alert tone="error" title={error} /> : null}

        <fieldset className="space-y-4">
          <legend className="mb-3 text-body font-bold text-neutral-900">Dados profissionais</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome completo" className="sm:col-span-2" error={form.name.trim().length > 0 && form.name.trim().length < 3 ? "Informe o nome completo." : null}>
              {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={120} autoComplete="off" />}
            </Field>
            <Field
              label="E-mail corporativo"
              className="sm:col-span-2"
              hint={isSelf ? "O próprio e-mail só pode ser alterado por outra pessoa administradora." : "É o login da pessoa. Ao trocar, as sessões abertas dela são encerradas."}
              error={emailInvalid ? "Informe um e-mail válido." : null}
            >
              {({ id, describedBy, invalid }) => (
                <Input id={id} aria-describedby={describedBy} invalid={invalid} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} leading={<Mail />} autoComplete="off" disabled={isSelf} />
              )}
            </Field>
            <Field label="Cargo">
              {({ id }) => (
                <Select id={id} value={form.position} onChange={(e) => set("position", e.target.value)}>
                  {!form.position ? <option value="">Selecione</option> : null}
                  {options.positions.map((p) => (
                    <option key={p.id} value={byId(p.id)}>
                      {p.name}
                    </option>
                  ))}
                  {POSITION_NAMES.filter((name) => !tenantPositions.has(name)).map((name) => (
                    <option key={name} value={byName(name)}>
                      {name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Nível">
              {({ id }) => (
                <Select id={id} value={form.jobLevel} onChange={(e) => set("jobLevel", e.target.value)}>
                  {!form.jobLevel ? <option value="">Selecione</option> : null}
                  {options.jobLevels.map((l) => (
                    <option key={l.id} value={byId(l.id)}>
                      {l.name}
                    </option>
                  ))}
                  {JOB_LEVEL_NAMES.filter((name) => !tenantLevels.has(name)).map((name) => (
                    <option key={name} value={byName(name)}>
                      {name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Área">
              {({ id }) => (
                <Select id={id} value={form.orgUnitId} onChange={(e) => set("orgUnitId", e.target.value)}>
                  {!form.orgUnitId ? <option value="">Selecione</option> : null}
                  {options.orgUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.type === "directorate" ? u.name : `— ${u.name}`}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Gestor(a)" hint="Somente pessoas com o papel Gestor.">
              {({ id, describedBy }) => (
                <Combobox
                  id={id}
                  aria-describedby={describedBy}
                  placeholder="Sem gestor(a)"
                  searchPlaceholder="Buscar pessoa…"
                  options={options.managers.filter((m) => m.id !== person.id).map((m) => ({ value: m.id, label: m.name, avatar: { name: m.name, src: m.image } }))}
                  value={form.managerId ? [form.managerId] : []}
                  onChange={(v) => set("managerId", v.at(-1) ?? "")}
                />
              )}
            </Field>
            <Field label="Localização">
              {({ id }) => (
                <Select id={id} value={form.location} onChange={(e) => set("location", e.target.value)}>
                  <option value="">Não informada</option>
                  {options.locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.city ? `${l.name} (${formatLocation(l.city, l.state)})` : l.name}
                    </option>
                  ))}
                  <option value={NEW_LOCATION}>Outra cidade…</option>
                </Select>
              )}
            </Field>
            <Field label="Data de entrada">{({ id, describedBy }) => <DatePicker id={id} aria-describedby={describedBy} value={form.hireDate} onChange={(v) => set("hireDate", v)} />}</Field>
            {newLocation ? (
              <div className="grid gap-4 sm:col-span-2 sm:grid-cols-[1fr_120px]">
                <Field label="Cidade">{({ id }) => <Input id={id} value={form.city} onChange={(e) => set("city", e.target.value)} maxLength={80} autoComplete="off" />}</Field>
                <Field label="UF" error={stateInvalid ? "Use a sigla (ex.: SP)." : null}>
                  {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} value={form.state} onChange={(e) => set("state", e.target.value.toUpperCase())} maxLength={2} autoComplete="off" />}
                </Field>
              </div>
            ) : null}
          </div>
        </fieldset>

        <div aria-hidden className="border-t border-line" />
        <fieldset className="space-y-4">
          <legend className="mb-3 text-body font-bold text-neutral-900">Dados pessoais e contrato</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome preferido" hint="Como a pessoa gosta de ser chamada (opcional).">
              {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} value={form.preferredName} onChange={(e) => set("preferredName", e.target.value)} maxLength={80} autoComplete="off" />}
            </Field>
            <Field label="Matrícula">{({ id }) => <Input id={id} value={form.employeeCode} onChange={(e) => set("employeeCode", e.target.value)} maxLength={40} autoComplete="off" />}</Field>
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
            <Field label="Situação do vínculo" hint="Não muda o acesso à plataforma (use “Desativar acesso”).">
              {({ id, describedBy }) => (
                <Select id={id} aria-describedby={describedBy} value={form.employmentStatus} onChange={(e) => set("employmentStatus", e.target.value)}>
                  {Object.entries(EMPLOYMENT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Telefone" error={phoneInvalid ? "Use só números, espaços, +, ( ) e -." : null}>
              {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} leading={<Phone />} maxLength={20} autoComplete="off" />}
            </Field>
          </div>
        </fieldset>

        <div className="flex justify-end gap-3 border-t border-line pt-4">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" loading={pending} disabled={!ready}>
            Salvar alterações
          </Button>
        </div>
      </form>
    </Modal>
  );
}

import { Briefcase, CalendarDays, FileBadge, Hash, Mail, MapPin, Network, Phone, UsersRound, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { Avatar } from "@/design-system/components/avatar";
import { Badge } from "@/design-system/components/badge";
import { Card, CardHeader } from "@/design-system/components/card";
import { Skeleton } from "@/design-system/components/feedback";
import { Breadcrumb } from "@/design-system/components/navigation";
import { RoleManager } from "@/features/access/role-manager";
import { CONTRACT_LABELS, formatDate, formatLocation } from "@/lib/format";
import { hasTenantWide } from "@/server/authz/policy";
import { requirePermission } from "@/server/dal";
import { HttpError } from "@/server/http/errors";
import { listRoles, listUserRoles } from "@/server/modules/access/service";
import { listOrgUnits } from "@/server/modules/organization/service";
import { getPerson } from "@/server/modules/people/service";

export const metadata: Metadata = { title: "Pessoa" };

export default function PersonPage({ params }: PageProps<"/gestao/usuarios/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <Person params={params} />
    </Suspense>
  );
}

function Row({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-4 py-2.5">
      <dt className="flex w-48 shrink-0 items-center gap-4 text-body-sm text-neutral-600">
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-500">
          <Icon className="size-[18px]" />
        </span>
        {label}
      </dt>
      <dd className="min-w-0 flex-1 truncate text-body-sm font-medium text-neutral-900">{value}</dd>
    </div>
  );
}

async function Person({ params }: { params: PageProps<"/gestao/usuarios/[id]">["params"] }) {
  const actor = await requirePermission("people.directory.read");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  let person: Awaited<ReturnType<typeof getPerson>>;
  try {
    person = await getPerson(actor, id);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }

  const canAssign = hasTenantWide(actor, "access.roles.assign");
  const [assignments, roles, orgUnits] = canAssign ? await Promise.all([listUserRoles(actor, id), listRoles(actor), listOrgUnits(actor)]) : [[], [], []];

  return (
    <>
      <div className="mb-5">
        <Breadcrumb items={[{ label: "Usuários", href: "/gestao/usuarios" }, { label: person.name }]} />
      </div>
      <section className="card mb-6 flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:p-8">
        <Avatar name={person.name} src={person.image} size="xl" className="size-24 text-h2" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-h1 font-extrabold tracking-[-0.02em] text-neutral-900">{person.name}</h1>
            <Badge tone={person.status === "active" ? "green" : "neutral"}>{person.status === "active" ? "Ativo" : person.status === "invited" ? "Convidado" : "Inativo"}</Badge>
          </div>
          <p className="mt-1 text-body text-neutral-600">{[person.position, person.level].filter(Boolean).join(" · ")}</p>
          {person.headline ? <p className="mt-3 text-body-sm italic text-neutral-600">“{person.headline}”</p> : null}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Dados profissionais" />
          <dl className="divide-y divide-line/60">
            <Row icon={Mail} label="E-mail" value={person.email} />
            <Row icon={Briefcase} label="Cargo" value={person.position ?? "—"} />
            <Row icon={Network} label="Área" value={person.orgUnit ?? "—"} />
            <Row icon={UsersRound} label="Gestor(a)" value={person.managerName ?? "—"} />
            <Row icon={MapPin} label="Localização" value={formatLocation(person.city, person.state)} />
            <Row icon={CalendarDays} label="Data de entrada" value={formatDate(person.hireDate)} />
          </dl>
        </Card>
        <div className="space-y-6">
          {person.personal ? (
            <Card>
              <CardHeader title="Dados pessoais" description="Visíveis apenas para quem administra pessoas." />
              <dl className="divide-y divide-line/60">
                <Row icon={Hash} label="Matrícula" value={person.personal.employeeCode ?? "—"} />
                <Row icon={FileBadge} label="Contrato" value={CONTRACT_LABELS[person.personal.contractType] ?? person.personal.contractType} />
                <Row icon={Phone} label="Telefone" value={person.personal.phone ?? "—"} />
              </dl>
            </Card>
          ) : null}
          {canAssign ? (
            <Card>
              <CardHeader title="Papéis de acesso" description="Definem o que a pessoa pode ver e fazer na plataforma." />
              <RoleManager
                userId={id}
                isSelf={id === actor.userId}
                assignments={assignments}
                roles={roles.map(({ id: roleId, key, name, description, defaultScope }) => ({ id: roleId, key, name, description, defaultScope }))}
                orgUnits={orgUnits}
              />
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

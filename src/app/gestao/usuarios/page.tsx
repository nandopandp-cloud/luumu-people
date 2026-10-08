import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Avatar } from "@/design-system/components/avatar";
import { Badge } from "@/design-system/components/badge";
import { Button } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { EmptyState } from "@/design-system/components/empty-state";
import { Skeleton } from "@/design-system/components/feedback";
import { Input } from "@/design-system/components/field";
import { CursorPagination } from "@/design-system/components/navigation";
import { Select } from "@/design-system/components/select";
import { Table, Td, Th, THead, Tr } from "@/design-system/components/table";
import { hasTenantWide } from "@/server/authz/policy";
import { requirePermission } from "@/server/dal";
import { listOrgUnits } from "@/server/modules/organization/service";
import { peopleQuerySchema } from "@/server/modules/people/schemas";
import { listPeople } from "@/server/modules/people/service";

export const metadata: Metadata = { title: "Usuários" };

const STATUS = {
  active: { label: "Ativo", tone: "green" },
  invited: { label: "Convidado", tone: "blue" },
  inactive: { label: "Inativo", tone: "neutral" },
} as const;

export default function UsersPage({ searchParams }: PageProps<"/gestao/usuarios">) {
  return (
    <>
      <header className="mb-6">
        <h1 className="text-h1 font-extrabold tracking-[-0.02em] text-neutral-900">Usuários</h1>
        <p className="mt-1 text-body text-neutral-600">Colaboradores, lotação e papéis de acesso.</p>
      </header>
      <Suspense fallback={<TableSkeleton />}>
        <Users searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Users({ searchParams }: { searchParams: PageProps<"/gestao/usuarios">["searchParams"] }) {
  const actor = await requirePermission("people.directory.read");
  const raw = await searchParams;
  const single = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
  const parsed = peopleQuerySchema.safeParse({
    search: single(raw.q),
    orgUnitId: single(raw.area),
    status: single(raw.status),
    cursor: single(raw.cursor),
  });
  const query = parsed.success ? parsed.data : peopleQuerySchema.parse({});
  const [page, orgUnits] = await Promise.all([listPeople(actor, query), listOrgUnits(actor)]);
  const tenantWide = hasTenantWide(actor, "people.directory.read");
  const filtered = Boolean(query.search || query.orgUnitId || query.status);

  const nextHref = page.nextCursor
    ? { pathname: "/gestao/usuarios", query: { ...(query.search && { q: query.search }), ...(query.orgUnitId && { area: query.orgUnitId }), ...(query.status && { status: query.status }), cursor: page.nextCursor } }
    : null;

  return (
    <Card className="p-5 sm:p-6">
      <form role="search" aria-label="Filtrar usuários" className="mb-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_200px_auto]">
        <label className="sr-only" htmlFor="q">
          Buscar por nome ou e-mail
        </label>
        <Input id="q" name="q" type="search" defaultValue={query.search} placeholder="Buscar por nome ou e-mail" leading={<Search />} />
        <label className="sr-only" htmlFor="area">
          Área
        </label>
        <Select id="area" name="area" defaultValue={query.orgUnitId ?? ""}>
          <option value="">Todas as áreas</option>
          {orgUnits.map((u) => (
            <option key={u.id} value={u.id}>
              {u.type === "directorate" ? u.name : `— ${u.name}`}
            </option>
          ))}
        </Select>
        <label className="sr-only" htmlFor="status">
          Situação
        </label>
        <Select id="status" name="status" defaultValue={query.status ?? ""}>
          <option value="">Todas as situações</option>
          <option value="active">Ativos</option>
          <option value="invited">Convidados</option>
          <option value="inactive">Inativos</option>
        </Select>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      {!tenantWide ? (
        <p className="mb-4 rounded-md bg-purple-50 px-4 py-2.5 text-body-sm text-purple-700">Você está vendo apenas as pessoas do seu escopo de acesso.</p>
      ) : null}

      {page.items.length === 0 ? (
        <EmptyState
          title={filtered ? "Nenhum resultado encontrado" : "Ninguém por aqui ainda"}
          description={filtered ? "Tente ajustar os filtros ou buscar por outro termo." : "As pessoas do seu escopo aparecem aqui."}
          action={
            filtered ? (
              <Button asChild variant="secondary">
                <Link href="/gestao/usuarios">Limpar filtros</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <Table>
            <caption className="sr-only">Colaboradores</caption>
            <THead>
              <tr>
                <Th>Pessoa</Th>
                <Th>Cargo</Th>
                <Th>Área</Th>
                <Th>Gestor(a)</Th>
                <Th>Situação</Th>
              </tr>
            </THead>
            <tbody>
              {page.items.map((person) => (
                <Tr key={person.id}>
                  <Td>
                    <Link href={`/gestao/usuarios/${person.id}`} className="group flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-purple-500">
                      <Avatar name={person.name} src={person.image} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-neutral-900 group-hover:text-purple-600">{person.name}</span>
                        <span className="block truncate text-caption text-neutral-500">{person.email}</span>
                      </span>
                    </Link>
                  </Td>
                  <Td data-label="Cargo">{person.position ?? "—"}</Td>
                  <Td data-label="Área">{person.orgUnit ?? "—"}</Td>
                  <Td data-label="Gestor(a)">{person.managerName ?? "—"}</Td>
                  <Td data-label="Situação">
                    <Badge tone={STATUS[person.status].tone}>{STATUS[person.status].label}</Badge>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <div className="mt-5">
            <CursorPagination
              summary={`${page.items.length} ${page.items.length === 1 ? "pessoa" : "pessoas"} nesta página`}
              firstHref={query.cursor ? { pathname: "/gestao/usuarios", query: { ...(query.search && { q: query.search }), ...(query.orgUnitId && { area: query.orgUnitId }) } } : null}
              nextHref={nextHref}
            />
          </div>
        </>
      )}
    </Card>
  );
}

function TableSkeleton() {
  return (
    <div className="card space-y-4 p-6" role="status" aria-busy="true" aria-label="Carregando usuários">
      <Skeleton className="h-11 w-full" />
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="hidden h-4 w-32 md:block" />
          <Skeleton className="hidden h-4 w-24 md:block" />
        </div>
      ))}
    </div>
  );
}

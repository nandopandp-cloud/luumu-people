import { Pin, Plus } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/design-system/components/badge";
import { Button } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { EmptyState } from "@/design-system/components/empty-state";
import { Skeleton } from "@/design-system/components/feedback";
import { LinkTabs } from "@/design-system/components/link-tabs";
import { Table, Td, Th, THead, Tr } from "@/design-system/components/table";
import { MANAGED_STATUS } from "@/features/announcements/labels";
import { CommunicationTabs } from "@/features/banners/communication-tabs";
import { ANNOUNCEMENT_CATEGORY } from "@/features/home/labels";
import { formatDateTime } from "@/lib/format";
import { hasTenantWide } from "@/server/authz/policy";
import { requirePermission } from "@/server/dal";
import { MANAGED_FILTERS, type ManagedFilter } from "@/server/modules/announcements/schemas";
import { listManagedAnnouncements } from "@/server/modules/announcements/service";

export const metadata: Metadata = { title: "Comunicação" };

const FILTER_LABELS: Record<ManagedFilter, string> = { todos: "Todos", rascunhos: "Rascunhos", agendados: "Agendados", publicados: "Publicados", arquivados: "Arquivados" };

type SP = PageProps<"/gestao/comunicacao">["searchParams"];

async function parseFilter(searchParams: SP): Promise<ManagedFilter> {
  const raw = (await searchParams).filtro;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (MANAGED_FILTERS as readonly string[]).includes(value ?? "") ? (value as ManagedFilter) : "todos";
}

export default function CommunicationPage({ searchParams }: PageProps<"/gestao/comunicacao">) {
  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h1 font-extrabold tracking-[-0.02em] text-neutral-900">Comunicação</h1>
          <p className="mt-1 text-body text-neutral-600">Mural corporativo: escreva, publique, agende e fixe comunicados.</p>
        </div>
        <Button asChild>
          <Link href="/gestao/comunicacao/novo">
            <Plus aria-hidden /> Novo comunicado
          </Link>
        </Button>
      </header>
      <Suspense fallback={null}>
        <Tabs />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-[420px] rounded-xl" />}>
        <List searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Tabs() {
  const actor = await requirePermission("comms.announcement.create");
  return <CommunicationTabs current="comunicados" canManageBanners={hasTenantWide(actor, "comms.announcement.publish")} />;
}

async function List({ searchParams }: { searchParams: SP }) {
  const [actor, filter] = await Promise.all([requirePermission("comms.announcement.create"), parseFilter(searchParams)]);
  const items = await listManagedAnnouncements(actor, filter);
  return (
    <div className="space-y-4">
      <LinkTabs
        label="Filtrar comunicados"
        current={filter}
        items={MANAGED_FILTERS.map((f) => ({ value: f, label: FILTER_LABELS[f], href: (f === "todos" ? "/gestao/comunicacao" : `/gestao/comunicacao?filtro=${f}`) as Route }))}
      />
      <Card className="p-0">
        {items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title={filter === "todos" ? "Nenhum comunicado criado" : "Nada por aqui neste filtro"}
              description="Crie um comunicado para aparecer no mural de todas as pessoas."
              action={
                <Button asChild variant="soft">
                  <Link href="/gestao/comunicacao/novo">
                    <Plus aria-hidden /> Novo comunicado
                  </Link>
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <Tr>
                  <Th>Comunicado</Th>
                  <Th>Categoria</Th>
                  <Th>Situação</Th>
                  <Th>Publicação</Th>
                  <Th>Atualizado</Th>
                </Tr>
              </THead>
              <tbody>
                {items.map((a) => {
                  const status = MANAGED_STATUS[a.managedStatus]!;
                  const cat = ANNOUNCEMENT_CATEGORY[a.category];
                  return (
                    <Tr key={a.id}>
                      <Td className="min-w-[260px]">
                        <Link href={`/gestao/comunicacao/${a.id}` as Route} className="font-semibold text-neutral-900 hover:text-purple-600 hover:underline">
                          {a.title}
                        </Link>
                        <p className="line-clamp-1 text-caption text-neutral-500">{a.summary}</p>
                      </Td>
                      <Td>{cat ? <Badge tone={cat.tone}>{cat.label}</Badge> : a.category}</Td>
                      <Td>
                        <span className="flex flex-wrap gap-1">
                          <Badge tone={status.tone}>{status.label}</Badge>
                          {a.pinned ? (
                            <Badge tone="yellow">
                              <Pin aria-hidden /> Fixado
                            </Badge>
                          ) : null}
                        </span>
                      </Td>
                      <Td className="whitespace-nowrap text-neutral-600">{a.publishedAt ? formatDateTime(a.publishedAt) : "—"}</Td>
                      <Td className="whitespace-nowrap text-neutral-600">
                        {formatDateTime(a.updatedAt)}
                        {a.author ? <span className="block text-caption text-neutral-500">por {a.author}</span> : null}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}

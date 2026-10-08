import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Avatar } from "@/design-system/components/avatar";
import { Button } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { EmptyState } from "@/design-system/components/empty-state";
import { Skeleton } from "@/design-system/components/feedback";
import { CursorPagination } from "@/design-system/components/navigation";
import { Select } from "@/design-system/components/select";
import { Table, Td, Th, THead, Tr } from "@/design-system/components/table";
import { AUDIT_LABELS, auditLabel, ROLE_LABELS } from "@/features/audit/labels";
import { formatDateTime } from "@/lib/format";
import { requirePermission } from "@/server/dal";
import { auditQuerySchema, listAuditLogs } from "@/server/modules/audit/service";

export const metadata: Metadata = { title: "Auditoria" };

export default function AuditPage({ searchParams }: PageProps<"/gestao/auditoria">) {
  return (
    <>
      <header className="mb-6">
        <h1 className="text-h1 font-extrabold tracking-[-0.02em] text-neutral-900">Auditoria</h1>
        <p className="mt-1 max-w-3xl text-body text-neutral-600">
          Registro permanente das ações sensíveis na plataforma. Por princípio, respostas de pesquisas anônimas nunca aparecem aqui.
        </p>
      </header>
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <AuditTable searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function describe(metadata: Record<string, unknown>): string | null {
  if (typeof metadata.role === "string") return `Papel: ${ROLE_LABELS[metadata.role] ?? metadata.role}`;
  if (Array.isArray(metadata.fields)) return `Campos: ${metadata.fields.join(", ")}`;
  return null;
}

async function AuditTable({ searchParams }: { searchParams: PageProps<"/gestao/auditoria">["searchParams"] }) {
  const actor = await requirePermission("audit.read");
  const raw = await searchParams;
  const single = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
  const parsed = auditQuerySchema.safeParse({ action: single(raw.acao), cursor: single(raw.cursor) });
  const query = parsed.success ? parsed.data : auditQuerySchema.parse({});
  const page = await listAuditLogs(actor, query);

  return (
    <Card className="p-5 sm:p-6">
      <form className="mb-5 flex flex-wrap gap-3" aria-label="Filtrar auditoria">
        <label htmlFor="acao" className="sr-only">
          Ação
        </label>
        <Select id="acao" name="acao" defaultValue={query.action ?? ""} className="min-w-64">
          <option value="">Todas as ações</option>
          {Object.entries(AUDIT_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      {page.items.length === 0 ? (
        <EmptyState
          title="Nenhum registro encontrado"
          description="Tente outro filtro."
          action={
            query.action ? (
              <Button asChild variant="secondary">
                <Link href="/gestao/auditoria">Limpar filtros</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <Table>
            <caption className="sr-only">Registros de auditoria</caption>
            <THead>
              <tr>
                <Th>Quando</Th>
                <Th>Quem</Th>
                <Th>Ação</Th>
                <Th>Detalhes</Th>
                <Th>IP</Th>
              </tr>
            </THead>
            <tbody>
              {page.items.map((item) => (
                <Tr key={item.id}>
                  <Td data-label="Quando" className="whitespace-nowrap tabular-nums">
                    <time dateTime={item.createdAt.toISOString()}>{formatDateTime(item.createdAt)}</time>
                  </Td>
                  <Td data-label="Quem">
                    <span className="flex items-center gap-2.5">
                      <Avatar name={item.actorName ?? "Sistema"} size="sm" />
                      <span className="font-medium text-neutral-900">{item.actorName ?? "Sistema"}</span>
                    </span>
                  </Td>
                  <Td data-label="Ação">{auditLabel(item.action)}</Td>
                  <Td data-label="Detalhes" className="text-neutral-500">
                    {describe(item.metadata) ?? "—"}
                  </Td>
                  <Td data-label="IP" className="tabular-nums text-neutral-500">
                    {item.ipAddress ?? "—"}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <div className="mt-5">
            <CursorPagination
              summary={`${page.items.length} registros nesta página`}
              firstHref={query.cursor ? { pathname: "/gestao/auditoria", query: query.action ? { acao: query.action } : {} } : null}
              nextHref={page.nextCursor ? { pathname: "/gestao/auditoria", query: { ...(query.action && { acao: query.action }), cursor: page.nextCursor } } : null}
            />
          </div>
        </>
      )}
    </Card>
  );
}

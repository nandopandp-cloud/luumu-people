import { Lock, Plus } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { forbidden } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/design-system/components/badge";
import { Button } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { EmptyState } from "@/design-system/components/empty-state";
import { Alert, Skeleton } from "@/design-system/components/feedback";
import { Progress } from "@/design-system/components/progress";
import { Table, Td, Th, THead, Tr } from "@/design-system/components/table";
import { formatDay, SURVEY_KIND } from "@/features/surveys/labels";
import { hasPermissionAnywhere, hasTenantWide } from "@/server/authz/policy";
import { requireActor } from "@/server/dal";
import { canReadAllResults, listManagedSurveys } from "@/server/modules/surveys/service";

export const metadata: Metadata = { title: "Pesquisas" };

const STATUS = { draft: { label: "Rascunho", tone: "neutral" }, active: { label: "Em andamento", tone: "green" }, closed: { label: "Encerrada", tone: "blue" } } as const;

export default function ManagementSurveysPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[420px] rounded-xl" />}>
      <Surveys />
    </Suspense>
  );
}

async function Surveys() {
  const actor = await requireActor();
  if (!(["survey.design", "survey.launch", "survey.results.read_aggregate"] as const).some((p) => hasPermissionAnywhere(actor, p))) forbidden();
  const items = await listManagedSurveys(actor);
  const canDesign = hasTenantWide(actor, "survey.design");

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h1 font-extrabold tracking-[-0.02em] text-neutral-900">Pesquisas</h1>
          <p className="mt-1 text-body text-neutral-600">Clima, eNPS e pulsos — com anonimato garantido por arquitetura.</p>
        </div>
        {canDesign ? (
          <Button asChild>
            <Link href="/gestao/pesquisas/nova">
              <Plus aria-hidden /> Nova pesquisa
            </Link>
          </Button>
        ) : null}
      </header>

      {!canReadAllResults(actor) ? (
        <Alert tone="info" title="Resultados por equipe chegam na próxima etapa" className="mb-4">
          Por enquanto, resultados ficam disponíveis para quem tem acesso à empresa toda. Sempre agregados e com o mínimo de respostas que preserva o anonimato.
        </Alert>
      ) : null}

      <Card className="p-0">
        {items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="Nenhuma pesquisa criada"
              description="Comece por um modelo de clima, eNPS ou pulso e ajuste as perguntas."
              action={
                canDesign ? (
                  <Button asChild variant="soft">
                    <Link href="/gestao/pesquisas/nova">
                      <Plus aria-hidden /> Nova pesquisa
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="px-5 pb-1 sm:px-6">
            <Table>
              <THead>
                <Tr>
                  <Th>Pesquisa</Th>
                  <Th>Tipo</Th>
                  <Th>Situação</Th>
                  <Th>Participação</Th>
                  <Th>Encerramento</Th>
                </Tr>
              </THead>
              <tbody>
                {items.map((s) => {
                  const kind = SURVEY_KIND[s.kind] ?? SURVEY_KIND.custom!;
                  const rate = s.invited ? Math.round((s.completed / s.invited) * 100) : 0;
                  return (
                    <Tr key={s.id}>
                      <Td className="min-w-[240px]">
                        <Link href={`/gestao/pesquisas/${s.id}` as Route} className="font-semibold text-neutral-900 hover:text-purple-600 hover:underline">
                          {s.title}
                        </Link>
                        <p className="flex items-center gap-1 text-caption text-neutral-500">
                          <Lock aria-hidden className="size-3" /> Anônima · k = {s.anonymityK} · {s.questions} {s.questions === 1 ? "pergunta" : "perguntas"}
                        </p>
                      </Td>
                      <Td>
                        <Badge tone={kind.tone}>{kind.label}</Badge>
                      </Td>
                      <Td>
                        <Badge tone={STATUS[s.status].tone}>{STATUS[s.status].label}</Badge>
                      </Td>
                      <Td className="min-w-[180px]">
                        {s.status === "draft" ? (
                          <span className="text-neutral-500">—</span>
                        ) : (
                          <>
                            <Progress value={rate} label={`Participação em ${s.title}`} />
                            <span className="text-caption text-neutral-500">
                              {s.completed} de {s.invited}
                            </span>
                          </>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-neutral-600">{s.closesAt ? formatDay(s.closesAt) : "—"}</Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}
      </Card>
    </>
  );
}

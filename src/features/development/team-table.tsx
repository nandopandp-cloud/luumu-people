"use client";

import { ArrowRight, Search } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import { Avatar } from "@/design-system/components/avatar";
import { Badge } from "@/design-system/components/badge";
import { Card, CardHeader } from "@/design-system/components/card";
import { EmptyState } from "@/design-system/components/empty-state";
import { Input } from "@/design-system/components/field";
import { Progress } from "@/design-system/components/progress";
import { Select } from "@/design-system/components/select";
import { Table, Td, Th, THead, Tr } from "@/design-system/components/table";
import type { TeamMember } from "@/server/modules/development/service";

const PAGE = 15;
const FILTERS = { todos: "Todas as pessoas", atrasadas: "Com ações atrasadas", "sem-pdi": "Sem PDI ativo" } as const;
type Filter = keyof typeof FILTERS;

const normalize = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Pessoas no escopo: busca por nome/cargo/área, filtros e paginação local. */
export function TeamTable({ members }: { members: TeamMember[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [limit, setLimit] = useState(PAGE);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return members.filter((m) => {
      if (filter === "atrasadas" && m.actionsLate === 0) return false;
      if (filter === "sem-pdi" && m.hasPdi) return false;
      return !q || normalize([m.name, m.position, m.orgUnit].filter(Boolean).join(" ")).includes(q);
    });
  }, [members, query, filter]);

  if (members.length === 0) {
    return (
      <Card>
        <EmptyState title="Ninguém no seu escopo ainda" description="As pessoas que você acompanha aparecem aqui." />
      </Card>
    );
  }
  const visible = filtered.slice(0, limit);
  return (
    <Card className="p-5 sm:p-6">
      <CardHeader title="Pessoas" description="Progresso do PDI, ações e média das competências." />
      <div className="mb-2 flex flex-wrap gap-3">
        <div className="min-w-56 flex-1">
          <Input
            type="search"
            aria-label="Buscar pessoa"
            placeholder="Buscar por nome, cargo ou área"
            leading={<Search aria-hidden className="size-4" />}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
          />
        </div>
        <Select
          aria-label="Filtrar pessoas"
          className="w-56"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value as Filter);
            setLimit(PAGE);
          }}
        >
          {Object.entries(FILTERS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      {filtered.length === 0 ? (
        <EmptyState compact title="Ninguém encontrado" description="Tente outro termo ou filtro." />
      ) : (
        <Table>
          <caption className="sr-only">Desenvolvimento das pessoas</caption>
          <THead>
            <tr>
              <Th>Pessoa</Th>
              <Th className="w-44">PDI</Th>
              <Th className="w-36">Ações</Th>
              <Th className="w-32 text-right">Competências</Th>
              <Th className="w-28">
                <span className="sr-only">Abrir</span>
              </Th>
            </tr>
          </THead>
          <tbody>
            {visible.map((m) => (
              <Tr key={m.id}>
                <Td>
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar name={m.name} src={m.image} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-neutral-900">{m.name}</span>
                      <span className="block truncate text-caption text-neutral-600">{[m.position, m.orgUnit].filter(Boolean).join(" · ")}</span>
                    </span>
                  </span>
                </Td>
                <Td data-label="PDI">{m.hasPdi ? <Progress value={m.progress} label={`PDI de ${m.name}`} /> : <Badge tone="neutral">Sem PDI</Badge>}</Td>
                <Td data-label="Ações" className="whitespace-nowrap tabular-nums">
                  {m.actionsDone}/{m.actionsTotal}
                  {m.actionsLate ? (
                    <Badge tone="red" className="ml-2">
                      {m.actionsLate} atrasada{m.actionsLate > 1 ? "s" : ""}
                    </Badge>
                  ) : null}
                </Td>
                <Td data-label="Competências" className="text-right tabular-nums">
                  {m.averageScore === null ? "—" : `${m.averageScore}%`}
                </Td>
                <Td className="text-right">
                  <Link
                    href={`/gestao/desenvolvimento/${m.id}` as Route}
                    aria-label={`Ver desenvolvimento de ${m.name}`}
                    className="inline-flex items-center gap-1 whitespace-nowrap text-body-sm font-medium text-purple-600 underline-offset-4 hover:underline"
                  >
                    Abrir <ArrowRight aria-hidden className="size-4" />
                  </Link>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
      <div className="mt-4 flex items-center justify-between gap-3 text-body-sm text-neutral-600">
        <span>
          {Math.min(limit, filtered.length)} de {filtered.length} pessoa{filtered.length === 1 ? "" : "s"}
        </span>
        {filtered.length > limit ? (
          <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="font-medium text-purple-600 underline-offset-4 hover:underline">
            Mostrar mais
          </button>
        ) : null}
      </div>
    </Card>
  );
}

"use client";

import { Filter, Search } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/design-system/components/button";
import { Drawer } from "@/design-system/components/dialog";
import { Field, Input } from "@/design-system/components/field";
import { Select } from "@/design-system/components/select";
import { directoryHref, type DirectoryParams } from "./params";

type Option = { id: string; name: string };

export type FilterOptions = {
  orgUnits: (Option & { type: string })[];
  positions: Option[];
  businessUnits: Option[];
  jobLevels: Option[];
  managers: Option[];
  canFilterEmployment: boolean;
};

/** Filtros da página Colaboradores: tudo na URL (link compartilhável, voltar funciona). */
export function DirectoryFilters({ params, options }: { params: DirectoryParams; options: FilterOptions }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(params.q ?? "");
  const [moreOpen, setMoreOpen] = useState(false);
  const typed = useRef(false);

  const go = (patch: Partial<DirectoryParams>) => startTransition(() => router.replace(directoryHref(params, { ...patch, pagina: undefined }) as Route, { scroll: false }));

  // Busca enquanto digita (com pausa), sem histórico a cada letra.
  useEffect(() => {
    if (!typed.current) return;
    const timer = window.setTimeout(() => go({ q: search.trim() || undefined }), 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage ao texto digitado
  }, [search]);

  const extra = [params.unidade, params.nivel, params.gestor].filter(Boolean).length;

  return (
    <form role="search" aria-label="Filtrar colaboradores" aria-busy={pending} className="card flex flex-wrap items-center gap-3 p-3.5" onSubmit={(e) => e.preventDefault()}>
      <div className="min-w-0 flex-[1_1_18rem]">
        <label className="sr-only" htmlFor="busca-colaboradores">
          Buscar por nome, e-mail, cargo ou área
        </label>
        <Input
          id="busca-colaboradores"
          type="search"
          value={search}
          onChange={(e) => {
            typed.current = true;
            setSearch(e.target.value);
          }}
          placeholder="Buscar por nome, e-mail, cargo ou área…"
          leading={<Search />}
        />
      </div>
      <div className="w-full sm:w-48">
        <Select aria-label="Área" value={params.area ?? ""} onChange={(e) => go({ area: e.target.value || undefined })}>
          <option value="">Todas as áreas</option>
          {options.orgUnits.map((u) => (
            <option key={u.id} value={u.id}>
              {u.type === "directorate" ? u.name : `— ${u.name}`}
            </option>
          ))}
        </Select>
      </div>
      <div className="w-full sm:w-48">
        <Select aria-label="Cargo" value={params.cargo ?? ""} onChange={(e) => go({ cargo: e.target.value || undefined })}>
          <option value="">Todos os cargos</option>
          {options.positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>
      {options.canFilterEmployment ? (
        <div className="w-full sm:w-48">
          <Select aria-label="Situação do vínculo" value={params.situacao ?? ""} onChange={(e) => go({ situacao: (e.target.value || undefined) as DirectoryParams["situacao"] })}>
            <option value="">Todas as situações</option>
            <option value="ativo">Em atividade</option>
            <option value="afastado">Afastados(as)</option>
            <option value="desligado">Desligados(as)</option>
          </Select>
        </div>
      ) : null}
      <Button type="button" variant="secondary" className="h-11" onClick={() => setMoreOpen(true)} aria-haspopup="dialog">
        <Filter aria-hidden /> Mais filtros
        {extra ? (
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-purple-500 text-[11px] text-white">
            {extra}
            <span className="sr-only"> {extra === 1 ? "filtro ativo" : "filtros ativos"}</span>
          </span>
        ) : null}
      </Button>
      {moreOpen ? <MoreFilters params={params} options={options} onClose={() => setMoreOpen(false)} onApply={go} /> : null}
    </form>
  );
}

function MoreFilters({ params, options, onClose, onApply }: { params: DirectoryParams; options: FilterOptions; onClose: () => void; onApply: (patch: Partial<DirectoryParams>) => void }) {
  const [unidade, setUnidade] = useState(params.unidade ?? "");
  const [nivel, setNivel] = useState(params.nivel ?? "");
  const [gestor, setGestor] = useState(params.gestor ?? "");
  const apply = (patch: Partial<DirectoryParams>) => {
    onApply(patch);
    onClose();
  };
  return (
    <Drawer
      open
      onOpenChange={(v) => !v && onClose()}
      title="Mais filtros"
      description="Refine a lista por unidade, nível ou gestor(a)."
      footer={
        <>
          <Button variant="ghost" onClick={() => apply({ unidade: undefined, nivel: undefined, gestor: undefined })}>
            Limpar
          </Button>
          <Button onClick={() => apply({ unidade: unidade || undefined, nivel: nivel || undefined, gestor: gestor || undefined })}>Aplicar filtros</Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Unidade">
          {({ id }) => (
            <Select id={id} value={unidade} onChange={(e) => setUnidade(e.target.value)}>
              <option value="">Todas as unidades</option>
              {options.businessUnits.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Nível">
          {({ id }) => (
            <Select id={id} value={nivel} onChange={(e) => setNivel(e.target.value)}>
              <option value="">Todos os níveis</option>
              {options.jobLevels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Gestor(a)">
          {({ id }) => (
            <Select id={id} value={gestor} onChange={(e) => setGestor(e.target.value)}>
              <option value="">Todos(as)</option>
              {options.managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
    </Drawer>
  );
}

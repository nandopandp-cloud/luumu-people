"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Field } from "@/design-system/components/field";
import { Select } from "@/design-system/components/select";

export type FilterOption = { value: string; label: string };

/**
 * Filtros do mural (categoria e período). Cada mudança atualiza a URL (dá para
 * compartilhar e voltar); sem JavaScript, o botão "Aplicar" envia o formulário.
 */
export function FeedFilters({ categories, periods, values, base }: { categories: FilterOption[]; periods: FilterOption[]; values: { categoria: string; periodo: string; aba?: string }; base: string }) {
  const router = useRouter();

  function apply(next: Partial<typeof values>) {
    const merged = { ...values, ...next };
    const query = new URLSearchParams();
    if (merged.aba) query.set("aba", merged.aba);
    if (merged.categoria) query.set("categoria", merged.categoria);
    if (merged.periodo && merged.periodo !== "recentes") query.set("periodo", merged.periodo);
    const qs = query.toString();
    router.push(`${base}${qs ? `?${qs}` : ""}` as Route, { scroll: false });
  }

  const filtered = Boolean(values.categoria) || values.periodo !== "recentes";
  return (
    <section aria-labelledby="filtrar-comunicados" className="card p-5">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 id="filtrar-comunicados" className="text-h4 font-bold text-neutral-900">
          Filtrar comunicados
        </h2>
        {filtered ? (
          <Link href={base as Route} scroll={false} className="text-body-sm font-medium text-purple-600 hover:text-purple-700 hover:underline underline-offset-4">
            Limpar filtros
          </Link>
        ) : null}
      </header>
      <form action={base} method="get" className="space-y-3" onSubmit={(e) => e.preventDefault()}>
        {values.aba ? <input type="hidden" name="aba" value={values.aba} /> : null}
        <Field label="Categoria">
          {(f) => (
            <Select id={f.id} name="categoria" value={values.categoria} onChange={(e) => apply({ categoria: e.target.value })}>
              <option value="">Todas</option>
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Período">
          {(f) => (
            <Select id={f.id} name="periodo" value={values.periodo} onChange={(e) => apply({ periodo: e.target.value })}>
              {periods.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <noscript>
          <button type="submit" className="text-body-sm font-medium text-purple-600">
            Aplicar
          </button>
        </noscript>
      </form>
    </section>
  );
}

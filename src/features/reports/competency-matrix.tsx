import Link from "next/link";
import type { Route } from "next";
import { Card, CardHeader } from "@/design-system/components/card";
import { EmptyState } from "@/design-system/components/empty-state";
import { cn } from "@/design-system/cn";
import { LEVEL } from "@/features/development/labels";
import type { MatrixRow } from "@/server/modules/development/service";

const CELL = {
  developed: "bg-green-100 text-green-800",
  developing: "bg-yellow-100 text-yellow-800",
  to_develop: "bg-red-100 text-red-700",
} as const;

/** Mapa de calor: pessoas × competências (última avaliação; cor = nível frente ao esperado do cargo). */
export function CompetencyMatrix({ competencies, rows }: { competencies: { id: string; name: string }[]; rows: MatrixRow[] }) {
  return (
    <Card className="p-5 sm:p-6">
      <CardHeader title="Mapa de competências" description="Última avaliação de cada pessoa. A cor compara o nível com o esperado para o cargo." />
      <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-caption text-neutral-600" aria-label="Legenda">
        {(Object.keys(CELL) as (keyof typeof CELL)[]).map((level) => (
          <li key={level} className="flex items-center gap-2">
            <span aria-hidden className={cn("size-3 rounded-sm", LEVEL[level].dot)} />
            {LEVEL[level].label}
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-sm bg-neutral-200" />
          Sem avaliação
        </li>
      </ul>
      {rows.length === 0 ? (
        <EmptyState compact title="Ninguém no seu escopo ainda" />
      ) : (
        <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
          <table className="w-full border-separate border-spacing-1 text-left text-body-sm">
            <caption className="sr-only">Nível atual de cada pessoa em cada competência, em porcentagem</caption>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 min-w-48 bg-white pb-2 text-caption font-semibold uppercase tracking-wide text-neutral-500">
                  Pessoa
                </th>
                {competencies.map((c) => (
                  <th key={c.id} scope="col" className="min-w-24 px-1 pb-2 align-bottom text-caption font-semibold leading-tight text-neutral-600">
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <th scope="row" className="sticky left-0 z-10 bg-white py-1 pr-3 font-normal">
                    <Link href={`/gestao/desenvolvimento/${r.id}` as Route} className="block truncate font-semibold text-neutral-900 underline-offset-4 hover:text-purple-600 hover:underline">
                      {r.name}
                    </Link>
                    <span className="block truncate text-caption text-neutral-600">{r.position ?? "—"}</span>
                  </th>
                  {competencies.map((c) => {
                    const cell = r.cells[c.id];
                    const score = cell?.score ?? null;
                    return (
                      <td
                        key={c.id}
                        title={score === null ? "Sem avaliação" : `${LEVEL[cell!.level].label} · esperado ${cell!.expected}%`}
                        className={cn("h-11 rounded-md text-center font-semibold tabular-nums", score === null ? "bg-neutral-100 text-neutral-500" : CELL[cell!.level])}
                      >
                        {score === null ? "—" : `${score}%`}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

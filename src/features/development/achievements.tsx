import { HexBadge } from "@/design-system/illustrations/hex-badge";
import { EmptyState } from "@/design-system/components/empty-state";
import type { Development } from "@/server/modules/development/service";
import { competencyTone, levelName } from "./labels";
import { SideCard } from "./side-cards";

const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });

/** Conquistas: nível atual de cada competência, quanto falta para o próximo e a linha do tempo. */
export function AchievementsPanel({ development }: { development: Development }) {
  const { competencies, milestones, isSelf } = development;
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section aria-labelledby="niveis-titulo" className="min-w-0">
        <h2 id="niveis-titulo" className="mb-4 text-h2 font-bold text-neutral-900">
          {isSelf ? "Meus níveis por competência" : "Níveis por competência"}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {competencies.map((c) => {
            const level = c.score === null ? 0 : Math.max(0, Math.min(5, Math.floor(c.score / 20)));
            const next = level < 5 ? (level + 1) * 20 : null;
            const inBand = c.score === null ? 0 : level === 5 ? 100 : ((c.score - level * 20) / 20) * 100;
            return (
              <li key={c.id} className="flex items-center gap-4 rounded-xl border border-line bg-white p-4 shadow-sm">
                <HexBadge icon={c.icon} theme={competencyTone(c.icon).badge} locked={level === 0} className="size-16" />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-body-sm font-bold text-neutral-900">{c.name}</h3>
                  <p className="text-caption text-neutral-600">{level ? `Nível ${level} · ${levelName(level)}` : "Ainda sem nível"}</p>
                  <div
                    role="progressbar"
                    aria-label={next ? `${c.name}: caminho até o nível ${level + 1}` : `${c.name}: nível máximo`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(inBand)}
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100"
                  >
                    <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-400" style={{ width: `${inBand}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-neutral-600">{next === null ? "Nível máximo alcançado 🎉" : c.score === null ? "Aguardando a primeira avaliação" : `Faltam ${next - c.score} pontos para o nível ${level + 1}`}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      <SideCard id="linha-conquistas" title="Linha do tempo">
        {milestones.length === 0 ? (
          <EmptyState compact title="Nenhuma conquista ainda" description="Cada nível alcançado numa competência aparece aqui." />
        ) : (
          <ol className="relative space-y-4 before:absolute before:inset-y-2 before:left-5 before:w-px before:bg-line">
            {milestones.map((m) => (
              <li key={`${m.competencyId}-${m.level}`} className="relative flex items-center gap-3">
                <HexBadge icon={m.icon} theme={competencyTone(m.icon).badge} className="size-10" />
                <div className="min-w-0">
                  <p className="text-body-sm font-semibold text-neutral-900">
                    {m.name} · Nível {m.level}
                  </p>
                  <p className="text-caption text-neutral-600">
                    {levelName(m.level)} · <time dateTime={new Date(m.achievedAt).toISOString()}>{dateFmt.format(new Date(m.achievedAt))}</time>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </SideCard>
    </div>
  );
}

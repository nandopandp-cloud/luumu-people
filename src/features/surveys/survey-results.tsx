import { CalendarClock, Lock, MessageSquareQuote, ShieldCheck, UserRound, Users, UsersRound } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/design-system/components/avatar";
import { Badge } from "@/design-system/components/badge";
import { DonutChart } from "@/design-system/components/charts";
import { Alert } from "@/design-system/components/feedback";
import { Progress } from "@/design-system/components/progress";
import { cn } from "@/design-system/cn";
import type { getSurveyResults, QuestionResult } from "@/server/modules/surveys/service";
import { ANONYMITY_COPY, DIMENSION_LABEL, formatDay, PRIVACY_COPY, SCALE_LABELS, SURVEY_KIND, SURVEY_STATUS } from "./labels";

type Data = Awaited<ReturnType<typeof getSurveyResults>>;
type Question = Data["questions"][number];

const pct = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0);
const fmt1 = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** eNPS = % promotores (9–10) − % detratores (0–6). */
export function enps(distribution: Record<string, number>) {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  const count = (from: number, to: number) => Object.entries(distribution).reduce((n, [v, c]) => (Number(v) >= from && Number(v) <= to ? n + c : n), 0);
  const promoters = count(9, 10);
  const passives = count(7, 8);
  const detractors = count(0, 6);
  return { total, promoters, passives, detractors, score: pct(promoters, total) - pct(detractors, total) };
}



/**
 * Resultados. Anônima: AGREGADOS do cofre, já com supressão por k (livre: k = 1);
 * esta tela só formata e nenhum dado individual existe para ser exibido.
 * Identificada: agregados + respostas por pessoa (só G&G chega aqui).
 */
export function SurveyResults({ data, basePath, actions }: { data: Data; basePath: string; actions?: ReactNode }) {
  const { survey, questions, participation, results, dimensions, dimension, bucket, groups, audience, individual } = data;
  const kind = SURVEY_KIND[survey.kind] ?? SURVEY_KIND.custom!;
  const released = results.suppressed ? 0 : results.responses;
  const identified = survey.anonymityMode === "identified";
  const free = !identified && survey.noMinimum;
  const href = (d?: string, b?: string) => ({ pathname: basePath, query: { ...(d && { dimensao: d }), ...(b && { grupo: b }) } });

  const scheduled = survey.scheduled;
  const status = scheduled ? "scheduled" : survey.status;

  return (
    <div className="space-y-6">
      <header className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={kind.tone}>{kind.label}</Badge>
              <Badge tone={SURVEY_STATUS[status].tone}>{SURVEY_STATUS[status].label}</Badge>
              {identified ? (
                <Badge tone="blue">
                  <UserRound aria-hidden /> {PRIVACY_COPY.identified.badge}
                </Badge>
              ) : (
                <Badge tone="purple">
                  <Lock aria-hidden /> {free ? PRIVACY_COPY.free.badge : `Anônima · k = ${survey.anonymityK}`}
                </Badge>
              )}
            </div>
            <h1 className="mt-3 text-h1 font-extrabold tracking-[-0.02em] text-neutral-900">{survey.title}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-body-sm text-neutral-600">
              <CalendarClock aria-hidden className="size-4" />
              {survey.launchedAt ? `${scheduled ? "Abre em" : "Lançada em"} ${formatDay(survey.launchedAt)}` : null}
              {survey.closesAt ? ` · ${survey.status === "closed" ? "encerrada em" : "encerra em"} ${formatDay(survey.closedAt ?? survey.closesAt)}` : null}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-body-sm text-neutral-600">
              <UsersRound aria-hidden className="size-4" />
              Público: {audience.length ? audience.map((a) => a.name).join(", ") : "toda a empresa"}
            </p>
          </div>
          {actions}
        </div>
        <dl className="mt-6 grid gap-4 sm:grid-cols-3">
          <Stat icon={<Users aria-hidden className="size-5" />} label="Participação" value={`${pct(participation.completed, participation.invited)}%`} caption={`${participation.completed} de ${participation.invited} pessoas responderam`} />
          <Stat
            icon={<ShieldCheck aria-hidden className="size-5" />}
            label="Respostas nos resultados"
            value={String(released)}
            caption={identified ? "Todas, com o nome de quem respondeu" : free ? "Desde a 1ª resposta, sem nome" : `Liberadas em lotes de pelo menos ${survey.anonymityK}`}
          />
          {identified || free ? (
            <Stat icon={<Lock aria-hidden className="size-5" />} label="Mínimo de respostas" value="Livre" caption={identified ? "Pesquisa identificada" : "Sem recortes por grupo"} />
          ) : (
            <Stat icon={<Lock aria-hidden className="size-5" />} label="Grupo mínimo" value={`${survey.anonymityK} pessoas`} caption="Grupos menores nunca aparecem" />
          )}
        </dl>
      </header>

      {identified ? <Alert tone="info" title={PRIVACY_COPY.identified.title}>Quem respondeu foi avisado de que as respostas ficam com o nome e são vistas só pelo time de Gente e Gestão.</Alert> : null}
      {free ? <Alert tone="warning" title={PRIVACY_COPY.free.title}>{PRIVACY_COPY.free.builder}</Alert> : null}

      {dimensions.length ? (
        <nav aria-label="Segmentar resultados" className="card space-y-3 p-5">
          <ul className="flex flex-wrap gap-1.5">
            <Chip href={href()} active={!dimension}>
              Empresa toda
            </Chip>
            {dimensions.map((d) => (
              <Chip key={d} href={href(d)} active={dimension === d}>
                Por {DIMENSION_LABEL[d]?.toLowerCase() ?? d}
              </Chip>
            ))}
          </ul>
          {dimension ? (
            groups.length ? (
              <ul className="flex flex-wrap gap-1.5 border-t border-line pt-3" aria-label={`Grupos de ${DIMENSION_LABEL[dimension]}`}>
                <Chip href={href(dimension)} active={!bucket} small>
                  Todos os grupos
                </Chip>
                {groups.map((g) => (
                  <Chip key={g.bucket} href={href(dimension, g.bucket)} active={bucket === g.bucket} small>
                    {g.bucket} <span className="opacity-75">({g.responses})</span>
                  </Chip>
                ))}
              </ul>
            ) : (
              <p className="border-t border-line pt-3 text-body-sm text-neutral-600">{ANONYMITY_COPY.suppressed}</p>
            )
          ) : null}
          <p className="text-caption text-neutral-500">Grupos com poucas respostas são reunidos em “Outros” para que ninguém possa ser identificado por diferença.</p>
        </nav>
      ) : null}

      {results.suppressed || released === 0 ? (
        identified || free ? (
          <Alert tone="info" title="Ainda não há respostas">
            {survey.status === "closed" ? "A pesquisa foi encerrada sem respostas." : "Os resultados aparecem aqui assim que alguém responder."}
          </Alert>
        ) : (
          <Alert tone="info" title={ANONYMITY_COPY.suppressed}>
            {survey.status === "active" ? `Os resultados aparecem quando houver pelo menos ${survey.anonymityK} respostas e são atualizados em lotes.` : null}
          </Alert>
        )
      ) : (
        <ol className="space-y-4">
          {questions.map((q, i) => {
            const r = results.questions.find((x) => x.questionId === q.id);
            return (
              <li key={q.id} className="card p-6">
                <h2 className="text-body font-semibold text-neutral-900">
                  <span className="mr-1.5 text-purple-600">{i + 1}.</span>
                  {q.text}
                </h2>
                <p className="mt-0.5 text-caption text-neutral-500">{r ? `${r.answered} ${r.answered === 1 ? "resposta" : "respostas"}` : "Sem respostas"}</p>
                <div className="mt-4">
                  {!r || r.answered === 0 ? (
                    <p className="text-body-sm text-neutral-600">Sem respostas para esta pergunta.</p>
                  ) : r.suppressed ? (
                    <p className="text-body-sm text-neutral-600">{ANONYMITY_COPY.suppressed}</p>
                  ) : (
                    <QuestionView question={q} result={r} identified={identified} />
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {individual?.length ? <IndividualResponses questions={questions} responses={individual} /> : null}
    </div>
  );
}

/** Respostas por pessoa (somente pesquisas IDENTIFICADAS). */
function IndividualResponses({ questions, responses }: { questions: Question[]; responses: NonNullable<Data["individual"]> }) {
  const shown = (q: Question, value: number | string | undefined) => {
    if (value === undefined || value === "") return "—";
    if (q.type === "scale" && typeof value === "number") return `${value} · ${SCALE_LABELS[value - 1] ?? ""}`;
    return String(value);
  };
  return (
    <section className="card p-6" aria-labelledby="respostas-por-pessoa">
      <h2 id="respostas-por-pessoa" className="text-h3 font-bold text-neutral-900">
        Respostas por pessoa <span className="font-semibold text-neutral-500">({responses.length})</span>
      </h2>
      <p className="mt-1 text-body-sm text-neutral-600">Visível só para o time de Gente e Gestão.</p>
      <ul className="mt-4 divide-y divide-line/60">
        {responses.map((r) => (
          <li key={r.userId}>
            <details className="group py-3">
              <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500">
                <Avatar name={r.name} src={r.image} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-sm font-semibold text-neutral-900">{r.name}</span>
                  <span className="block truncate text-caption text-neutral-500">{[r.orgUnit, `respondeu em ${formatDay(r.submittedAt)}`].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="text-caption font-medium text-purple-600 group-open:hidden">Ver respostas</span>
                <span className="hidden text-caption font-medium text-purple-600 group-open:inline">Ocultar</span>
              </summary>
              <dl className="mt-3 space-y-2 pl-11">
                {questions.map((q, i) => (
                  <div key={q.id} className="text-body-sm">
                    <dt className="text-neutral-600">
                      {i + 1}. {q.text}
                    </dt>
                    <dd className="font-medium text-neutral-900">{shown(q, r.answers[q.id])}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stat({ icon, label, value, caption }: { icon: ReactNode; label: string; value: string; caption: string }) {
  return (
    <div className="rounded-xl border border-line bg-neutral-50/60 p-4">
      <dt className="flex items-center gap-2 text-body-sm font-medium text-neutral-600">
        <span className="text-purple-500">{icon}</span>
        {label}
      </dt>
      <dd className="mt-1">
        <span className="block text-[26px] font-bold leading-tight text-neutral-900">{value}</span>
        <span className="text-caption text-neutral-500">{caption}</span>
      </dd>
    </div>
  );
}

function Chip({ href, active, small, children }: { href: React.ComponentProps<typeof Link>["href"]; active: boolean; small?: boolean; children: ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        scroll={false}
        aria-current={active ? "page" : undefined}
        className={cn(
          "inline-flex items-center gap-1 rounded-full font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500",
          small ? "h-8 px-3 text-caption" : "h-9 px-4 text-body-sm",
          active ? "bg-purple-500 text-white" : "bg-white text-neutral-600 ring-1 ring-line hover:bg-purple-50 hover:text-purple-600",
        )}
      >
        {children}
      </Link>
    </li>
  );
}

function Bars({ rows, total, label }: { rows: { label: string; count: number }[]; total: number; label: string }) {
  return (
    <ul className="space-y-2.5" aria-label={label}>
      {rows.map((row) => (
        <li key={row.label} className="grid grid-cols-[minmax(0,180px)_1fr] items-center gap-3 text-body-sm">
          <span className="truncate text-neutral-700" title={row.label}>
            {row.label}
          </span>
          <span className="flex items-center gap-2">
            <Progress value={pct(row.count, total)} label={`${row.label}: ${pct(row.count, total)}%`} className="flex-1" />
            <span className="w-10 text-right text-caption tabular-nums text-neutral-500">({row.count})</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function QuestionView({ question: q, result: r, identified }: { question: Question; result: QuestionResult; identified: boolean }) {
  const dist = r.distribution ?? {};
  if (q.type === "scale") {
    const favorable = (dist["4"] ?? 0) + (dist["5"] ?? 0);
    return (
      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <div>
          <p className="text-[34px] font-bold leading-none text-neutral-900">{fmt1(r.average ?? 0)}</p>
          <p className="mt-1 text-caption text-neutral-500">média de 1 a 5</p>
          <p className="mt-3 text-[22px] font-bold leading-none text-green-700">{pct(favorable, r.answered)}%</p>
          <p className="mt-1 text-caption text-neutral-500">favorabilidade (4 e 5)</p>
        </div>
        <Bars label="Distribuição das respostas" total={r.answered} rows={SCALE_LABELS.map((label, i) => ({ label: `${i + 1} · ${label}`, count: dist[String(i + 1)] ?? 0 }))} />
      </div>
    );
  }
  if (q.type === "enps") {
    const e = enps(dist);
    return (
      <div className="grid items-center gap-6 md:grid-cols-[260px_1fr]">
        <DonutChart
          title="Composição do eNPS"
          centerLabel={{ value: String(e.score), caption: "eNPS" }}
          data={[
            { label: "Promotores (9–10)", value: e.promoters },
            { label: "Neutros (7–8)", value: e.passives },
            { label: "Detratores (0–6)", value: e.detractors },
          ]}
        />
        <div className="space-y-2 text-body-sm text-neutral-700">
          <p>
            <strong className="text-[28px] font-bold text-neutral-900">{e.score}</strong> <span className="text-neutral-500">eNPS (de −100 a 100)</span>
          </p>
          <p>Média das notas: {fmt1(r.average ?? 0)}</p>
          <p className="text-caption text-neutral-500">eNPS = % de promotores − % de detratores.</p>
        </div>
      </div>
    );
  }
  if (q.type === "choice") {
    return <Bars label="Distribuição das escolhas" total={r.answered} rows={(q.options ?? []).map((o) => ({ label: o, count: dist[o] ?? 0 }))} />;
  }
  const comments = r.comments ?? [];
  return (
    <div>
      <p className="mb-3 flex items-center gap-1.5 text-caption text-neutral-500">
        <MessageSquareQuote aria-hidden className="size-4" />{" "}
        {identified ? "Quem escreveu cada comentário aparece em “Respostas por pessoa”." : "Em ordem aleatória, sem data e sem nenhuma informação de quem escreveu."}
      </p>
      <ul className="space-y-2">
        {comments.map((c, i) => (
          <li key={i} className="rounded-lg bg-neutral-50 px-4 py-3 text-body-sm text-neutral-800">
            {c}
          </li>
        ))}
      </ul>
    </div>
  );
}

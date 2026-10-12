import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarDays,
  ChevronRight,
  CircleCheck,
  ClipboardList,
  Clock3,
  Gauge,
  Heart,
  ListChecks,
  Lock,
  ShieldCheck,
  Sprout,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { Badge } from "@/design-system/components/badge";
import { Button } from "@/design-system/components/button";
import { CircularProgress } from "@/design-system/components/progress";
import { cn } from "@/design-system/cn";
import { SurveyCardScene, SurveysBackdrop, SurveysHeroScene } from "@/design-system/illustrations/survey-scenes";
import type { MySurvey } from "@/server/modules/surveys/service";
import { formatDay, SURVEY_KIND } from "./labels";

/** Ícone e cor de cada tipo de pesquisa (lista de respondidas). */
const KIND_TILE: Record<string, { icon: LucideIcon; tile: string }> = {
  climate: { icon: Sprout, tile: "bg-purple-100 text-purple-600" },
  enps: { icon: Gauge, tile: "bg-green-100 text-green-700" },
  pulse: { icon: Activity, tile: "bg-orange-100 text-orange-700" },
  custom: { icon: ClipboardList, tile: "bg-yellow-100 text-yellow-700" },
};

/** Cabeçalho da página de pesquisas: chamada, o Luumu no escritório e os porquês de participar. */
export function SurveysHero() {
  return (
    <section
      aria-labelledby="pesquisas-titulo"
      className="@container relative mb-8 overflow-hidden rounded-xl border border-purple-100 bg-gradient-to-r from-purple-50 via-purple-100/60 to-purple-100 shadow-sm"
    >
      <SurveysBackdrop className="absolute inset-0 hidden size-full @min-[700px]:block" />
      {/* Cena com o Luumu: ocupa o espaço entre o texto e o cartão (ou até a borda, sem o cartão). */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-6 top-3 hidden w-[clamp(280px,calc(100cqw-540px),470px)] @min-[700px]:block @min-[1300px]:right-[338px] @min-[1300px]:w-[clamp(300px,calc(100cqw-830px),470px)]"
      >
        <SurveysHeroScene className="size-full" />
      </div>
      <div className="relative flex min-h-[248px] items-center gap-6 px-6 py-6 sm:px-9">
        <div className="min-w-0 max-w-[460px] flex-1">
          <p className="text-body-sm font-semibold uppercase tracking-[0.18em] text-purple-600">Pesquisas</p>
          <h1 id="pesquisas-titulo" className="mt-2 text-[2.25rem] font-extrabold leading-[1.05] tracking-[-0.035em] text-neutral-900 sm:text-display">
            Sua opinião <span className="text-purple-500">importa!</span>
          </h1>
          <p className="mt-3 max-w-[420px] text-body text-neutral-700 sm:text-[17px]">Ajude a construir um ambiente cada vez melhor para todas as pessoas.</p>
        </div>

        <aside
          aria-labelledby="por-que-participar"
          className="relative ml-auto hidden w-[290px] shrink-0 rounded-xl border border-white/80 bg-white/95 px-6 py-5 shadow-md backdrop-blur @min-[1300px]:block"
        >
          <h2 id="por-que-participar" className="text-h3 font-bold leading-snug tracking-[-0.01em] text-neutral-900">
            Juntos por um ambiente mais incrível
          </h2>
          <ul className="mt-3 space-y-2.5 text-body-sm text-neutral-800">
            {[
              { icon: BarChart3, label: "Mais transparência", tile: "bg-blue-100 text-blue-700" },
              { icon: UsersRound, label: "Melhores decisões", tile: "bg-purple-100 text-purple-600" },
              { icon: Heart, label: "Um time mais feliz", tile: "bg-pink-100 text-red-500" },
            ].map(({ icon: Icon, label, tile }) => (
              <li key={label} className="flex items-center gap-3">
                <span aria-hidden className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", tile)}>
                  <Icon className={cn("size-4", Icon === Heart && "fill-current")} />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}

/** Pesquisa aberta para a pessoa responder. */
export function OpenSurveyCard({ survey: s }: { survey: MySurvey }) {
  const kind = SURVEY_KIND[s.kind] ?? SURVEY_KIND.custom!;
  const deadline = s.daysLeft === 0 ? "Encerra hoje" : `${s.daysLeft} ${s.daysLeft === 1 ? "dia restante" : "dias restantes"}`;
  return (
    <div className="@container">
      <article
        aria-labelledby={`pesquisa-${s.id}`}
        className="card grid gap-6 p-4 sm:p-5 @min-[640px]:grid-cols-[minmax(240px,340px)_minmax(0,1fr)] @min-[1080px]:grid-cols-[minmax(260px,330px)_minmax(0,1fr)_272px] @min-[1260px]:grid-cols-[minmax(300px,344px)_minmax(0,1fr)_300px]"
      >
        <div className="relative aspect-[344/222] w-full self-center overflow-hidden rounded-lg">
          <SurveyCardScene className="absolute inset-0 size-full" />
        </div>

        <div className="flex min-w-0 flex-col justify-center py-1">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={kind.tone} size="md">
              {kind.label}
            </Badge>
            {s.anonymous ? (
              <Badge tone="purple" size="md">
                <Lock aria-hidden /> Anônima
              </Badge>
            ) : (
              <Badge tone="blue" size="md">
                Identificada
              </Badge>
            )}
          </div>
          <h3 id={`pesquisa-${s.id}`} className="mt-3 text-h2 font-extrabold leading-tight tracking-[-0.02em] text-neutral-900">
            {s.title}
          </h3>
          {s.description ? <p className="mt-2 max-w-xl text-body text-neutral-700">{s.description}</p> : null}
          <p className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5 text-body-sm text-neutral-600">
            <span className="inline-flex items-center gap-1.5">
              <ListChecks aria-hidden className="size-4" /> {s.questions} {s.questions === 1 ? "pergunta" : "perguntas"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays aria-hidden className="size-4" /> Responda até {formatDay(s.closesAt)}
            </span>
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Button asChild size="lg" className="h-12 px-6 shadow-md">
              <Link href={`/pesquisas/${s.id}` as Route}>
                Responder pesquisa <ArrowRight aria-hidden />
                <span className="sr-only">: {s.title}</span>
              </Link>
            </Button>
            <span className="inline-flex items-center gap-1.5 text-body-sm text-neutral-600">
              <Clock3 aria-hidden className="size-4" /> Tempo estimado: {s.estimatedMinutes} min
            </span>
          </div>
        </div>

        <div className="border-line @min-[640px]:col-span-2 @min-[640px]:flex @min-[640px]:items-center @min-[640px]:justify-between @min-[640px]:gap-6 @min-[640px]:border-t @min-[640px]:pt-5 @min-[1080px]:col-span-1 @min-[1080px]:block @min-[1080px]:border-l @min-[1080px]:border-t-0 @min-[1080px]:pl-6 @min-[1080px]:pt-0">
          <div className="flex items-center gap-4">
            <CircularProgress value={s.timeLeftPercent} label={`Prazo da pesquisa: ${deadline}`} size={64} stroke={8} hideValue />
            <div>
              <p className="text-body font-bold text-neutral-900">{deadline}</p>
              <p className="text-body-sm text-neutral-600">Ajude nossa empresa a evoluir com a sua opinião.</p>
            </div>
          </div>
          <ul className="mt-5 space-y-3 border-t border-line pt-5 text-body-sm text-neutral-800 @min-[640px]:mt-0 @min-[640px]:flex @min-[640px]:flex-wrap @min-[640px]:gap-x-6 @min-[640px]:gap-y-2 @min-[640px]:space-y-0 @min-[640px]:border-t-0 @min-[640px]:pt-0 @min-[1080px]:mt-5 @min-[1080px]:block @min-[1080px]:space-y-3 @min-[1080px]:border-t @min-[1080px]:pt-5">
            {[
              s.anonymous ? { icon: Lock, label: "100% anônima" } : { icon: UsersRound, label: "Esta pesquisa é identificada" },
              { icon: UsersRound, label: "Para todas as pessoas" },
              { icon: ShieldCheck, label: "Seus dados são protegidos" },
            ].map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3">
                <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-700">
                  <Icon className="size-4" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>
      </article>
    </div>
  );
}

/** Linha da lista de pesquisas respondidas (ou encerradas sem resposta). */
export function PastSurveyRow({ survey: s }: { survey: MySurvey }) {
  const { icon: Icon, tile } = KIND_TILE[s.kind] ?? KIND_TILE.custom!;
  const answered = s.state === "answered";
  return (
    <Link
      href={`/pesquisas/${s.id}` as Route}
      className="group flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4 transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-purple-500 sm:flex-nowrap"
    >
      <span aria-hidden className={cn("flex size-14 shrink-0 items-center justify-center rounded-lg", tile)}>
        <Icon className="size-6" />
      </span>
      <span className="min-w-0 flex-1 basis-60">
        <span className="block font-semibold text-neutral-900 group-hover:text-purple-600">{s.title}</span>
        <span className="mt-0.5 block text-body-sm text-neutral-600">
          {answered ? "Obrigado por compartilhar sua opinião! Suas respostas ajudam a construir um ambiente melhor." : "O prazo terminou antes da sua resposta."}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2.5 text-body-sm text-neutral-600">
        <CalendarDays aria-hidden className="size-5 text-neutral-500" />
        <span className="leading-snug">
          {answered ? "Respondida em" : "Encerrada em"}
          <br />
          <span className="text-neutral-800">{answered && s.completedOn ? formatDay(`${s.completedOn}T12:00:00-03:00`) : formatDay(s.closesAt)}</span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-4 sm:w-44 sm:justify-end">
        {answered ? (
          <Badge tone="green" size="md">
            <CircleCheck aria-hidden /> Respondida
          </Badge>
        ) : (
          <Badge tone="neutral" size="md">
            Encerrada
          </Badge>
        )}
        <ChevronRight aria-hidden className="size-5 text-neutral-500 group-hover:text-purple-600" />
      </span>
    </Link>
  );
}

/** Título de seção com contador em pílula (ex.: "Pesquisa em andamento 1"). */
export function CountedHeading({ id, children, count }: { id: string; children: string; count: number }) {
  return (
    <h2 id={id} className="flex items-center gap-2.5 text-h3 font-bold tracking-[-0.01em] text-neutral-900">
      {children}
      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-purple-100 px-2 text-caption font-bold text-purple-700">{count}</span>
    </h2>
  );
}

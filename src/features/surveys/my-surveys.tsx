import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarDays,
  ChevronRight,
  CircleCheck,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Frown,
  Gauge,
  Heart,
  Lightbulb,
  ListChecks,
  Lock,
  Meh,
  MessageSquareText,
  ShieldCheck,
  Smile,
  Sprout,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { Badge } from "@/design-system/components/badge";
import { Mascot } from "@/design-system/components/brand";
import { Button } from "@/design-system/components/button";
import { CircularProgress } from "@/design-system/components/progress";
import { cn } from "@/design-system/cn";
import type { MySurvey } from "@/server/modules/surveys/service";
import { formatDay, SURVEY_KIND } from "./labels";

/** Ícone e cor de cada tipo de pesquisa (lista de respondidas). */
const KIND_TILE: Record<string, { icon: LucideIcon; tile: string }> = {
  climate: { icon: Sprout, tile: "bg-purple-100 text-purple-600" },
  enps: { icon: Gauge, tile: "bg-green-100 text-green-700" },
  pulse: { icon: Activity, tile: "bg-orange-100 text-orange-700" },
  custom: { icon: ClipboardList, tile: "bg-yellow-100 text-yellow-700" },
};

/** Cabeçalho da página de pesquisas: chamada, mascote e os porquês de participar. */
export function SurveysHero() {
  return (
    <section aria-labelledby="pesquisas-titulo" className="relative mb-8 overflow-hidden rounded-xl border border-purple-100 bg-gradient-to-r from-purple-50 via-purple-100/70 to-purple-100 px-6 py-8 shadow-sm sm:px-9 sm:py-10">
      <div aria-hidden className="pointer-events-none absolute -bottom-24 left-[42%] size-72 rounded-full bg-white/50 blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 size-72 rounded-full bg-purple-200/50 blur-3xl" />
      <div className="relative flex items-center gap-6">
        <div className="min-w-0 max-w-xl flex-1">
          <p className="text-body-sm font-semibold uppercase tracking-[0.18em] text-purple-600">Pesquisas</p>
          <h1 id="pesquisas-titulo" className="mt-2 text-[2.25rem] font-extrabold leading-[1.05] tracking-[-0.035em] text-neutral-900 sm:text-display">
            Sua opinião <span className="text-purple-500">importa!</span>
          </h1>
          <p className="mt-3 max-w-md text-body text-neutral-700 sm:text-[17px]">Ajude a construir um ambiente cada vez melhor para todas as pessoas.</p>
        </div>

        <div aria-hidden className="relative -my-10 hidden h-[236px] w-[330px] shrink-0 self-end 2xl:block">
          <span className="absolute left-0 top-16 flex size-14 items-center justify-center rounded-full bg-yellow-100 text-orange-500 shadow-sm">
            <Lightbulb className="size-7" />
          </span>
          <span className="absolute left-14 top-7 flex size-10 items-center justify-center rounded-full bg-white/80 text-purple-500 shadow-sm">
            <MessageSquareText className="size-5" />
          </span>
          <div className="absolute right-0 top-3 z-10 w-40 rounded-lg border border-line bg-white px-3.5 py-2.5 text-body-sm font-medium leading-snug text-neutral-800 shadow-md">
            Pequenas opiniões geram grandes mudanças! <span className="text-purple-500">💜</span>
            <span className="absolute -bottom-2 left-8 size-4 rotate-45 border-b border-r border-line bg-white" />
          </div>
          <div className="absolute -bottom-4 left-6 h-10 w-64 rounded-[50%] bg-white/70" />
          <Mascot className="absolute bottom-1 left-[104px] h-[168px]" />
          {/* Notebook visto por trás, na frente do mascote. */}
          <div className="absolute bottom-1 left-6 w-[124px]">
            <div className="mx-auto flex h-[60px] w-[104px] items-center justify-center rounded-t-lg border border-neutral-300 bg-gradient-to-b from-neutral-100 to-neutral-300 shadow-md">
              <Sprout className="size-5 text-neutral-400" />
            </div>
            <div className="h-2.5 rounded-b-md rounded-t-sm bg-neutral-300 shadow-sm" />
          </div>
        </div>

        <aside aria-labelledby="por-que-participar" className="relative hidden w-[290px] shrink-0 rounded-xl bg-white/95 p-5 shadow-md lg:block">
          <h2 id="por-que-participar" className="text-h4 font-bold leading-snug text-neutral-900">
            Juntos por um ambiente mais incrível
          </h2>
          <ul className="mt-3 space-y-2.5 text-body-sm text-neutral-800">
            {[
              { icon: BarChart3, label: "Mais transparência", tile: "bg-blue-100 text-blue-700" },
              { icon: UsersRound, label: "Melhores decisões", tile: "bg-purple-100 text-purple-600" },
              { icon: Heart, label: "Um time mais feliz", tile: "bg-pink-100 text-pink-700" },
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

/** Arte do card da pesquisa: carinhas de humor, balão e o mascote com a prancheta. */
function SurveyArt() {
  return (
    <div aria-hidden className="relative isolate h-full min-h-[220px] overflow-hidden rounded-lg bg-gradient-to-br from-purple-50 via-purple-100 to-purple-200">
      <div className="absolute -left-8 bottom-6 size-32 rounded-full bg-white/50" />
      <div className="absolute -right-6 -top-10 size-40 rounded-full bg-white/40" />
      <span className="absolute left-[28%] top-[12%] flex h-11 w-20 items-center gap-1.5 rounded-lg bg-purple-400 px-2.5 shadow-md">
        <span className="size-3 rounded-full bg-white/90" />
        <span className="h-1.5 flex-1 rounded-full bg-white/90" />
      </span>
      <span className="absolute left-[8%] top-[28%] flex size-14 items-center justify-center rounded-full bg-green-500 text-white shadow-md">
        <Smile className="size-9" />
      </span>
      <span className="absolute left-[42%] top-[36%] flex size-12 items-center justify-center rounded-full bg-yellow-100 text-yellow-700 shadow-md">
        <Meh className="size-8" />
      </span>
      <span className="absolute left-[24%] top-[50%] flex size-14 items-center justify-center rounded-full bg-red-500 text-white shadow-md">
        <Frown className="size-9" />
      </span>
      <span className="absolute bottom-[14%] left-[8%] flex size-11 items-center justify-center rounded-full bg-white/70 text-purple-400">
        <MessageSquareText className="size-5" />
      </span>
      <Mascot className="absolute -bottom-2 right-[4%] h-[78%]" />
      <span className="absolute bottom-[6%] right-[34%] flex size-14 -rotate-6 items-center justify-center rounded-md bg-white text-purple-500 shadow-lg">
        <ClipboardCheck className="size-8" />
      </span>
    </div>
  );
}

/** Pesquisa aberta para a pessoa responder. */
export function OpenSurveyCard({ survey: s }: { survey: MySurvey }) {
  const kind = SURVEY_KIND[s.kind] ?? SURVEY_KIND.custom!;
  const deadline = s.daysLeft === 0 ? "Encerra hoje" : `${s.daysLeft} ${s.daysLeft === 1 ? "dia restante" : "dias restantes"}`;
  return (
    <article aria-labelledby={`pesquisa-${s.id}`} className="card grid gap-6 p-4 sm:p-5 lg:grid-cols-[minmax(240px,340px)_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(0,1fr)_300px]">
      <SurveyArt />

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
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
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

      <div className="border-line lg:col-span-2 lg:flex lg:items-center lg:justify-between lg:gap-6 lg:border-t lg:pt-5 2xl:col-span-1 2xl:block 2xl:border-l 2xl:border-t-0 2xl:pl-6 2xl:pt-0">
        <div className="flex items-center gap-4">
          <CircularProgress value={s.timeLeftPercent} label={`Prazo da pesquisa: ${deadline}`} size={64} stroke={8} hideValue />
          <div>
            <p className="text-body font-bold text-neutral-900">{deadline}</p>
            <p className="text-body-sm text-neutral-600">Ajude nossa empresa a evoluir com a sua opinião.</p>
          </div>
        </div>
        <ul className="mt-5 space-y-3 border-t border-line pt-5 text-body-sm text-neutral-800 lg:mt-0 lg:flex lg:flex-wrap lg:gap-x-6 lg:gap-y-2 lg:space-y-0 lg:border-t-0 lg:pt-0 2xl:mt-5 2xl:block 2xl:space-y-3 2xl:border-t 2xl:pt-5">
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

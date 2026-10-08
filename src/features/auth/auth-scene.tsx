import { ArrowUp, ChartColumn, GraduationCap, Leaf as LeafIcon, Star, User, Users } from "lucide-react";
import { Mascot, Wordmark } from "@/design-system/components/brand";
import { cn } from "@/design-system/cn";

/** Folha estilizada (mesma linguagem do cabeçalho das páginas). */
function Leaf({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 96" aria-hidden className={className}>
      <path d="M32 94C10 70 2 44 14 20 20 8 30 2 32 0c2 2 12 8 18 20 12 24 4 50-18 74Z" fill="#85C926" />
      <path d="M32 94C26 70 24 40 32 0c2 2 12 8 18 20 12 24 4 50-18 74Z" fill="#4E9F2E" />
    </svg>
  );
}

const FEATURES = [
  { icon: GraduationCap, label: "Desenvolvimento contínuo", box: "bg-purple-100 text-purple-600" },
  { icon: Users, label: "Cultura e engajamento", box: "bg-blue-100 text-blue-700" },
  { icon: ChartColumn, label: "Pesquisas e insights reais", box: "bg-purple-100 text-purple-600" },
  { icon: Star, label: "Conquistas que impulsionam", box: "bg-orange-100 text-orange-500", fill: true },
];

const AVATAR_TONES = ["bg-pink-100 text-pink-700", "bg-orange-100 text-orange-700", "bg-blue-100 text-blue-700", "bg-green-100 text-green-700"];

/**
 * Painel de marca das telas de acesso: proposta de valor + cena ilustrada.
 * Decorativo (a cena inteira é aria-hidden); sem números fictícios.
 */
export function AuthScene() {
  return (
    <div className="relative grid h-full gap-6 overflow-hidden bg-gradient-to-br from-purple-50 via-purple-100 to-purple-50 p-10 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] xl:p-14">
      {/* Luz de janela ao fundo */}
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-[34rem] w-[30rem] rounded-[45%] bg-white/50 blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute bottom-0 right-1/4 size-80 rounded-full bg-purple-200/50 blur-3xl" />

      <div className="relative flex flex-col">
        <Wordmark className="h-auto w-[270px] max-w-full" />
        <p className="mt-10 text-[2.35rem] font-extrabold leading-[1.08] tracking-[-0.035em] text-neutral-900 xl:text-[2.6rem]">
          Pessoas que aprendem, crescem e <span className="text-purple-500">constroem juntas.</span>
        </p>
        <p className="mt-4 max-w-sm text-body leading-relaxed text-neutral-600">
          A Luumu People é a plataforma de experiência, desenvolvimento e inteligência de pessoas que conecta aprendizado, cultura e resultados dentro da sua empresa.
        </p>
        <ul className="mt-8 space-y-4">
          {FEATURES.map(({ icon: Icon, label, box, fill }) => (
            <li key={label} className="flex items-center gap-4">
              <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-2xl", box)}>
                <Icon aria-hidden className={cn("size-7", fill && "fill-current")} strokeWidth={2.2} />
              </span>
              <span className="max-w-[9.5rem] text-body-sm font-medium leading-snug text-neutral-800">{label}</span>
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-10">
          <div aria-hidden className="flex gap-2">
            <span className="h-1.5 w-12 rounded-full bg-purple-500" />
            <span className="h-1.5 w-12 rounded-full bg-purple-200" />
            <span className="h-1.5 w-12 rounded-full bg-purple-200" />
          </div>
          <p className="mt-4 max-w-[12rem] text-body-sm text-neutral-600">Uma plataforma completa para o futuro das pessoas.</p>
        </div>
      </div>

      {/* Cena: mascote no puff, notebook, livros, plantas e cards flutuantes */}
      <div aria-hidden className="relative hidden min-h-[560px] xl:block">
        <div className="absolute right-0 top-[4%] z-10 w-[300px] rounded-2xl bg-white/90 p-5 shadow-lg backdrop-blur">
          <div className="flex items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-500">
              <ChartColumn className="size-6 fill-purple-500" />
            </span>
            <div className="min-w-0">
              <p className="text-body-sm font-medium leading-snug text-neutral-800">Aprendizado em evolução</p>
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-green-100 px-2 py-0.5 text-body-sm font-semibold text-green-700">
                <ArrowUp className="size-4" /> em alta
              </span>
            </div>
            <svg viewBox="0 0 90 40" className="ml-auto h-10 w-[90px] shrink-0">
              <path d="M4 34c14 4 18-6 30-10s14 2 26-6 18-14 26-14" fill="none" stroke="var(--color-purple-500)" strokeWidth="3" strokeLinecap="round" />
              <circle cx="86" cy="4" r="3.5" fill="var(--color-purple-500)" />
            </svg>
          </div>
        </div>
        <div className="absolute right-[2%] top-[24%] z-10 w-[270px] rounded-2xl bg-white/90 p-5 shadow-lg backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">
              <LeafIcon className="size-6 fill-green-500" />
            </span>
            <p className="text-body-sm font-medium leading-snug text-neutral-800">Pessoas mais engajadas</p>
          </div>
          <div className="mt-3 flex items-center">
            {AVATAR_TONES.map((tone, i) => (
              <span key={tone} className={cn("flex size-10 items-center justify-center rounded-full ring-2 ring-white", tone, i > 0 && "-ml-2.5")}>
                <User className="size-5" />
              </span>
            ))}
            <span className="ml-3 text-body-sm font-semibold text-neutral-800">+ você</span>
          </div>
        </div>

        <Leaf className="absolute left-[2%] top-[34%] h-28 -rotate-[38deg] opacity-80" />
        <Leaf className="absolute left-[-4%] top-[58%] h-36 -rotate-[60deg]" />
        <Leaf className="absolute right-[4%] top-[52%] h-32 rotate-[28deg]" />
        <Leaf className="absolute right-[-2%] top-[60%] h-40 rotate-[52deg] opacity-90" />

        {/* Puff */}
        <div className="absolute bottom-[2%] left-[-2%] h-[36%] w-[86%] rounded-[48%_48%_42%_42%] bg-gradient-to-b from-orange-50 to-yellow-100 shadow-[inset_0_-18px_40px_rgb(0_0_0/0.06)]" />
        <Mascot className="absolute bottom-[12%] left-[14%] h-[46%] w-auto drop-shadow-[0_24px_30px_rgb(76_29_149/0.25)]" />
        {/* Notebook */}
        <svg viewBox="0 0 200 130" className="absolute bottom-[11%] left-[8%] z-10 w-[36%] -rotate-[10deg] drop-shadow-lg">
          <path d="M28 8h144a8 8 0 0 1 8 8v86H20V16a8 8 0 0 1 8-8Z" fill="#E5E7EB" />
          <path d="M34 16h132v78H34z" fill="#F3F4F6" />
          <path d="M100 44c8 6 8 18 0 26-8-8-8-20 0-26Z" fill="#D1D5DB" />
          <path d="M4 102h192l-8 14a10 10 0 0 1-8.6 5H20.6A10 10 0 0 1 12 116Z" fill="#D1D5DB" />
        </svg>

        {/* Livros */}
        <div className="absolute bottom-[3%] right-[-14%] z-10 w-[58%] space-y-1.5 whitespace-nowrap">
          <div className="ml-6 rotate-[4deg] rounded-l-lg bg-purple-500 px-5 py-2.5 text-xl font-bold text-white shadow-md">Aprendizado</div>
          <div className="ml-2 rotate-[3deg] rounded-l-lg bg-orange-600 px-5 py-2.5 text-xl font-bold text-white shadow-md">Pessoas</div>
          <div className="rotate-[2deg] rounded-l-lg bg-neutral-700 px-5 py-2.5 text-xl font-bold text-white shadow-md">Grandes Resultados</div>
        </div>
      </div>
    </div>
  );
}

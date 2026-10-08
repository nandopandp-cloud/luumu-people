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
 * Painel de marca das telas de acesso: proposta de valor à esquerda e a cena
 * ilustrada ocupando a direita e o fundo do painel (posições em % do painel,
 * como na referência). Decorativa (aria-hidden) e sem números fictícios.
 */
export function AuthScene() {
  return (
    <div className="relative h-full overflow-hidden bg-gradient-to-br from-purple-50 via-purple-100 to-purple-50">
      {/* Janela em arco ao fundo */}
      <div aria-hidden className="absolute right-0 top-0 hidden h-[56%] w-[40%] rounded-bl-[48px] rounded-tl-[220px] border-l-[14px] border-b-[14px] border-white/50 bg-gradient-to-b from-white/70 to-purple-50/40 xl:block" />
      <div aria-hidden className="pointer-events-none absolute bottom-0 left-1/3 size-96 rounded-full bg-purple-200/50 blur-3xl" />

      {/* Proposta de valor */}
      <div className="relative z-10 flex h-full flex-col p-12 xl:p-16">
        <Wordmark className="h-auto w-[280px] max-w-full" />
        <p className="mt-9 max-w-[420px] text-[2.6rem] font-extrabold leading-[1.06] tracking-[-0.035em] text-neutral-900 xl:text-[2.75rem]">
          Pessoas que aprendem, crescem e <span className="text-purple-500">constroem juntas.</span>
        </p>
        <p className="mt-4 max-w-[300px] text-[17px] leading-relaxed text-neutral-600">
          A Luumu People é a plataforma de experiência, desenvolvimento e inteligência de pessoas que conecta aprendizado, cultura e resultados dentro da sua empresa.
        </p>
        <ul className="mt-8 space-y-4">
          {FEATURES.map(({ icon: Icon, label, box, fill }) => (
            <li key={label} className="flex items-center gap-5">
              <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-lg", box)}>
                <Icon aria-hidden className={cn("size-7", fill && "fill-current")} strokeWidth={2.4} />
              </span>
              <span className="max-w-[9.5rem] text-[15px] font-medium leading-snug text-neutral-800">{label}</span>
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-10">
          <div aria-hidden className="flex gap-2">
            <span className="h-1.5 w-[52px] rounded-full bg-purple-500" />
            <span className="h-1.5 w-[44px] rounded-full bg-purple-200" />
            <span className="h-1.5 w-[44px] rounded-full bg-purple-200" />
          </div>
          <p className="mt-5 max-w-[12rem] text-body-sm text-neutral-600">Uma plataforma completa para o futuro das pessoas.</p>
        </div>
      </div>

      {/* Cena (somente telas largas, para não cobrir o texto) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden xl:block">
        <Leaf className="absolute left-[50%] top-[16%] h-16 rotate-[20deg] opacity-40" />
        <Leaf className="absolute left-[50%] top-[36%] h-24 -rotate-[30deg] opacity-70" />

        <div className="absolute left-[60.5%] top-[16%] z-20 w-[36%] max-w-[330px] rounded-lg bg-white/90 p-5 shadow-lg backdrop-blur">
          <div className="flex items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-500">
              <ChartColumn className="size-6 fill-purple-500" strokeWidth={2.4} />
            </span>
            <div className="min-w-0">
              <p className="text-body-sm font-medium leading-snug text-neutral-800">
                Aprendizado
                <br />
                em evolução
              </p>
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-sm bg-green-100 px-2 py-0.5 text-body-sm font-semibold text-green-700">
                <ArrowUp className="size-4" /> em alta
              </span>
            </div>
            <svg viewBox="0 0 96 44" className="ml-auto h-11 w-24 shrink-0">
              <path d="M4 38c14 4 20-8 32-10s14 4 26-6 18-16 30-18" fill="none" stroke="var(--color-purple-500)" strokeWidth="3.5" strokeLinecap="round" />
              <circle cx="92" cy="4.5" r="3.5" fill="var(--color-purple-500)" />
            </svg>
          </div>
        </div>
        <div className="absolute left-[65%] top-[30.5%] z-20 w-[32%] max-w-[290px] rounded-lg bg-white/90 p-5 shadow-lg backdrop-blur">
          <div className="flex items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">
              <LeafIcon className="size-6 fill-green-500" />
            </span>
            <p className="text-body-sm font-medium leading-snug text-neutral-800">
              Pessoas
              <br />
              mais engajadas
            </p>
          </div>
          <div className="mt-3 flex items-center">
            {AVATAR_TONES.map((tone, i) => (
              <span key={tone} className={cn("flex size-11 items-center justify-center rounded-full ring-2 ring-white", tone, i > 0 && "-ml-2.5")}>
                <User className="size-5" />
              </span>
            ))}
            <span className="ml-3 text-body font-semibold text-neutral-800">+ você</span>
          </div>
        </div>

        {/* Plantas atrás do puff */}
        <Leaf className="absolute left-[37%] top-[57%] h-36 -rotate-[48deg]" />
        <Leaf className="absolute left-[35%] top-[64%] h-32 -rotate-[78deg] opacity-90" />
        <Leaf className="absolute left-[90%] top-[52%] h-36 rotate-[18deg]" />
        <Leaf className="absolute left-[93%] top-[62%] h-32 rotate-[48deg] opacity-90" />

        {/* Puff */}
        <div className="absolute left-[36%] top-[56%] h-[48%] w-[60%] rounded-[46%_46%_38%_38%] bg-gradient-to-b from-orange-50 via-orange-50 to-orange-100 shadow-[inset_0_-24px_48px_rgb(120_80_40/0.08),0_20px_40px_-20px_rgb(76_29_149/0.25)]" />
        <Mascot className="absolute left-[43%] top-[46%] h-[44%] w-auto drop-shadow-[0_24px_30px_rgb(76_29_149/0.25)]" />

        {/* Notebook */}
        <svg viewBox="0 0 200 130" className="absolute left-[37%] top-[75%] z-10 w-[20%] -rotate-[14deg] drop-shadow-xl">
          <path d="M28 8h144a8 8 0 0 1 8 8v86H20V16a8 8 0 0 1 8-8Z" fill="#E5E7EB" />
          <path d="M34 16h132v78H34z" fill="#F3F4F6" />
          <path d="M100 44c8 6 8 18 0 26-8-8-8-20 0-26Z" fill="#D1D5DB" />
          <path d="M4 102h192l-8 14a10 10 0 0 1-8.6 5H20.6A10 10 0 0 1 12 116Z" fill="#CBD5E1" />
        </svg>

        {/* Mesinha e livros (cortados pela borda do painel) */}
        <div className="absolute left-[64%] top-[93%] h-[12%] w-[30%] rounded-[50%] bg-white/60 shadow-lg" />
        <div className="absolute left-[79%] top-[79%] z-10 w-[30%] space-y-1.5 whitespace-nowrap">
          <div className="ml-4 rotate-[5deg] rounded-l-md bg-purple-500 px-6 py-3 text-xl font-bold text-white shadow-md">Aprendizado</div>
          <div className="ml-1 rotate-[4deg] rounded-l-md bg-orange-600 px-6 py-3 text-xl font-bold text-white shadow-md">Pessoas</div>
          <div className="rotate-[3deg] rounded-l-md bg-neutral-700 px-6 py-3 text-xl font-bold text-white shadow-md">Grandes Resultados</div>
        </div>
      </div>
    </div>
  );
}

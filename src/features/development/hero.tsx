import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/design-system/cn";

/**
 * Banners do Desenvolvimento (mockups "Visão geral" e "Meu PDI"): texto à
 * esquerda e a arte à direita. O balão de fala é HTML (nítido e legível) e fica
 * exatamente sobre a área da arte em que ele estava no mockup. Em telas menores
 * a arte é recortada pela esquerda e, sem espaço, o balão (e a arte) saem.
 */
function Bubble({ children, className, style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={cn("absolute z-10 flex flex-col justify-center rounded-xl border border-line bg-white px-4 text-body-sm font-semibold leading-snug text-neutral-800 shadow-md", className)} style={style}>
      <p>{children}</p>
      <span aria-hidden className="mt-1 text-purple-500">
        💜
      </span>
      <span aria-hidden className="absolute -bottom-[7px] left-7 size-3.5 rotate-45 border-b border-r border-line bg-white" />
    </div>
  );
}

/** Visão geral: "Seu crescimento é único." com a foto e o mascote. */
export function DevelopmentHero() {
  return (
    <section aria-labelledby="desenvolvimento-titulo" className="@container card relative mb-6 overflow-hidden bg-gradient-to-r from-white via-purple-50/60 to-purple-100/70 p-0">
      <div aria-hidden className="pointer-events-none absolute -left-16 -top-24 size-72 rounded-full bg-purple-100/60 blur-2xl" />
      <div className="relative z-10 flex min-h-[220px] max-w-[460px] flex-col justify-center px-6 py-8 sm:px-8 @[60rem]:h-[248px]">
        <p className="text-body font-semibold text-purple-600">Desenvolvimento</p>
        <h1 id="desenvolvimento-titulo" className="mt-1.5 text-[2.25rem] font-extrabold leading-[1.05] tracking-[-0.03em] text-neutral-900 sm:text-display">
          Seu crescimento <span className="block bg-gradient-to-r from-purple-600 to-purple-400 bg-clip-text text-transparent">é único.</span>
        </h1>
        <p className="mt-3 max-w-[400px] text-body text-neutral-600">Aqui você acompanha suas competências, seu plano de desenvolvimento e sua evolução.</p>
      </div>
      {/* Arte: 619×241 (mockup) exibida a 248 px de altura → 638 px de largura. */}
      <div aria-hidden className="absolute inset-y-0 right-0 hidden w-[min(638px,calc(100%-440px))] @[60rem]:block">
        {/* eslint-disable-next-line @next/next/no-img-element -- arte estática e decorativa */}
        <img src="/images/development/hero-overview.webp" alt="" width={619} height={241} className="size-full object-cover object-right" draggable={false} />
        <Bubble className="right-[50px] top-[30px] h-[132px] w-[180px]">Grandes pessoas estão sempre em desenvolvimento!</Bubble>
      </div>
    </section>
  );
}

/** Meu PDI: trilha de volta, título e o alvo com o mascote. */
export function PdiHero({ title = "Meu PDI", description = "Seu plano de desenvolvimento pessoal, com objetivos, ações e acompanhamento da sua evolução." }: { title?: string; description?: string }) {
  return (
    <section aria-labelledby="pdi-titulo" className="@container card relative mb-6 overflow-hidden bg-gradient-to-r from-white via-white to-purple-50 p-0">
      <div className="relative z-10 flex min-h-[160px] max-w-[480px] flex-col justify-center py-6 pl-6 pr-4 sm:pl-8 @[56rem]:h-[160px] @[56rem]:py-0">
        <Link href="/desenvolvimento" className="inline-flex w-fit items-center gap-1 text-body-sm text-neutral-600 hover:text-purple-600 focus-visible:outline-2 focus-visible:outline-purple-500">
          <ChevronRight aria-hidden className="size-4" /> Desenvolvimento
        </Link>
        <h1 id="pdi-titulo" className="mt-0.5 text-[2.25rem] font-extrabold leading-[1.05] tracking-[-0.03em] text-neutral-900 sm:text-[2.5rem]">
          {title}
        </h1>
        <p className="mt-1.5 text-body-sm text-neutral-600 sm:text-body">{description}</p>
      </div>
      {/*
        Arte: 717×171 (mockup) a 160 px de altura → 671 px. Com espaço, inteira e
        com o balão; sem, só o alvo e o mascote (os 470 px da direita).
      */}
      <div aria-hidden className="absolute inset-y-0 right-0 hidden w-[min(470px,calc(100%-480px))] @[56rem]:block @[70rem]:w-[671px]">
        {/* eslint-disable-next-line @next/next/no-img-element -- arte estática e decorativa */}
        <img src="/images/development/hero-pdi.webp" alt="" width={717} height={171} className="size-full object-cover object-right" draggable={false} />
        <Bubble className="right-[470px] top-[30px] hidden h-[102px] w-[172px] @[70rem]:flex">Disciplina hoje, grandes conquistas amanhã!</Bubble>
      </div>
    </section>
  );
}

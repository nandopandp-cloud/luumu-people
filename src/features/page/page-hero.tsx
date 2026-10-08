import type { ReactNode } from "react";
import { Mascot } from "@/design-system/components/brand";
import { cn } from "@/design-system/cn";

function Leaf({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 96" aria-hidden className={className}>
      <path d="M32 94C10 70 2 44 14 20 20 8 30 2 32 0c2 2 12 8 18 20 12 24 4 50-18 74Z" fill="#85C926" />
      <path d="M32 94C26 70 24 40 32 0c2 2 12 8 18 20 12 24 4 50-18 74Z" fill="#4E9F2E" />
    </svg>
  );
}

/**
 * Cabeçalho de página dos mockups: título forte, subtítulo acolhedor, abas
 * opcionais e o mascote com um balão de fala.
 */
export function PageHero({ title, description, bubble, children, className }: { title: ReactNode; description?: ReactNode; bubble?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <section className={cn("card relative mb-6 overflow-hidden px-6 py-7 sm:px-8 sm:py-8", className)}>
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 size-80 rounded-full bg-purple-100/70 blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute right-40 top-6 size-24 rounded-full bg-purple-50" />
      <div className="relative flex items-end gap-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-[2rem] font-extrabold leading-[1.1] tracking-[-0.03em] text-neutral-900 sm:text-display">{title}</h1>
          {description ? <p className="mt-3 max-w-xl text-body text-neutral-600 sm:text-[17px]">{description}</p> : null}
        </div>
        <div aria-hidden className="relative hidden h-40 w-[300px] shrink-0 lg:block">
          {bubble ? (
            <div className="absolute left-0 top-0 z-10 w-40 rounded-lg border border-line bg-white px-3.5 py-2.5 text-body-sm font-medium leading-snug text-neutral-800 shadow-md">
              {bubble} <span className="text-purple-500">💜</span>
              <span className="absolute -right-2 top-6 size-4 rotate-45 border-r border-t border-line bg-white" />
            </div>
          ) : null}
          <Leaf className="absolute bottom-0 right-28 h-20 -rotate-[28deg]" />
          <Leaf className="absolute bottom-0 right-0 h-24 rotate-[24deg]" />
          <Mascot className="absolute bottom-0 right-6 h-36" />
        </div>
      </div>
      {children ? <div className="relative mt-6">{children}</div> : null}
    </section>
  );
}

import { Globe } from "lucide-react";
import { Wordmark } from "@/design-system/components/brand";
import { AuthHero, AuthScene } from "@/features/auth/auth-scene";

/**
 * Telas públicas (login e recuperação). A partir de 1024 px: tela cheia, sem bordas,
 * com a proposta de valor e a cena da marca à esquerda e o formulário à direita.
 * No celular e no tablet: fundo lilás com a proposta e a ilustração no topo, e o
 * formulário num cartão branco sobre o fim da ilustração.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-purple-50 via-purple-50 to-purple-100 lg:bg-white lg:bg-none">
      <div className="grid min-h-dvh overflow-hidden lg:h-dvh lg:grid-cols-[minmax(0,1.5fr)_minmax(440px,1fr)] xl:grid-cols-[minmax(0,1fr)_minmax(440px,32%)]">
        <aside className="hidden lg:block" aria-label="Sobre a Luumu People">
          <AuthScene />
        </aside>
        <main className="relative mx-auto flex w-full max-w-[560px] flex-col px-4 pb-6 pt-5 lg:max-w-none lg:bg-white lg:px-14 lg:py-5 xl:px-10 2xl:px-16">
          {/* Formas suaves do fundo lilás (só no celular e no tablet). */}
          <div aria-hidden className="pointer-events-none absolute inset-0 lg:hidden">
            <span className="absolute -left-32 -top-28 size-80 rounded-full bg-white/70" />
            <span className="absolute -right-44 top-28 size-[26rem] rounded-full bg-purple-100/80" />
          </div>
          <div className="relative flex items-center justify-between px-2 lg:justify-end lg:px-0">
            <Wordmark className="h-11 w-auto max-[359px]:h-9 lg:hidden" />
            <label className="relative flex h-11 items-center gap-2 rounded-full border border-line bg-white px-4 max-[359px]:px-3 text-body-sm font-medium text-neutral-700 shadow-sm lg:h-auto lg:border-0 lg:bg-transparent lg:px-0 lg:shadow-none">
              <Globe aria-hidden className="size-5 text-neutral-600" />
              <span className="sr-only">Idioma</span>
              <select defaultValue="pt-BR" className="cursor-pointer appearance-none bg-transparent pr-5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500">
                <option value="pt-BR">Português</option>
              </select>
              <svg aria-hidden viewBox="0 0 12 12" className="pointer-events-none absolute right-4 size-3 text-neutral-600 max-[359px]:right-3 lg:right-0">
                <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </label>
          </div>
          <AuthHero className="relative lg:hidden" />
          <div className="relative flex flex-1 items-start lg:items-center lg:py-4">
            <div className="-mt-7 w-full rounded-xl bg-white px-6 py-7 shadow-lg sm:px-8 lg:mx-auto lg:mt-0 lg:max-w-[460px] lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

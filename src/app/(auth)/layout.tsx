import { Globe } from "lucide-react";
import { Wordmark } from "@/design-system/components/brand";
import { AuthScene } from "@/features/auth/auth-scene";

/**
 * Telas públicas (login e recuperação): cartão grande com a proposta de valor
 * e a cena da marca à esquerda e o formulário à direita.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas lg:p-6">
      <div className="mx-auto grid min-h-dvh max-w-[1520px] overflow-hidden bg-white lg:min-h-[calc(100dvh-3rem)] lg:grid-cols-[minmax(0,1.5fr)_minmax(440px,1fr)] lg:rounded-[32px] lg:border lg:border-line lg:shadow-lg">
        <aside className="hidden lg:block" aria-label="Sobre a Luumu People">
          <AuthScene />
        </aside>
        <main className="flex flex-col px-6 py-8 sm:px-12 lg:px-14 xl:px-20">
          <div className="flex items-center justify-between lg:justify-end">
            <Wordmark className="h-11 w-auto lg:hidden" />
            <label className="relative flex items-center gap-2 text-body-sm font-medium text-neutral-700">
              <Globe aria-hidden className="size-5 text-neutral-600" />
              <span className="sr-only">Idioma</span>
              <select defaultValue="pt-BR" className="cursor-pointer appearance-none bg-transparent pr-5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500">
                <option value="pt-BR">Português</option>
              </select>
              <svg aria-hidden viewBox="0 0 12 12" className="pointer-events-none absolute right-0 size-3 text-neutral-600">
                <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </label>
          </div>
          <div className="flex flex-1 items-center py-10">
            <div className="mx-auto w-full max-w-[460px]">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}

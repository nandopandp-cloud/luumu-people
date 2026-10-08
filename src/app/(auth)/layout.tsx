import { Logo, Mascot } from "@/design-system/components/brand";

/** Layout das telas públicas (login e recuperação): marca à esquerda, formulário à direita. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-purple-100 via-[#ece5fc] to-purple-200 p-12 lg:flex lg:flex-col">
        <div aria-hidden className="absolute -left-24 -top-24 size-96 rounded-full bg-white/40 blur-3xl" />
        <div aria-hidden className="absolute -bottom-32 right-0 size-[28rem] rounded-full bg-purple-300/30 blur-3xl" />
        <Logo className="relative h-20 self-start" />
        <div className="relative mt-auto max-w-md">
          <p className="text-[2.5rem] font-extrabold leading-[1.08] tracking-[-0.03em] text-neutral-900">
            Pessoas que aprendem, crescem e <span className="text-purple-500">constroem juntas.</span>
          </p>
          <p className="mt-4 text-body text-neutral-700">A plataforma de experiência, desenvolvimento e inteligência de pessoas da sua empresa.</p>
        </div>
        <Mascot className="relative mt-10 h-56 self-end" />
      </aside>
      <main className="flex items-center justify-center bg-canvas px-4 py-12 sm:px-8">
        <div className="w-full max-w-[440px]">
          <Logo className="mx-auto mb-10 h-14 lg:hidden" />
          {children}
        </div>
      </main>
    </div>
  );
}

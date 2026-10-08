import type { ReactNode } from "react";
import { Suspense } from "react";
import { Logo } from "@/design-system/components/brand";
import { EmployeeBottomNav, EmployeeSidebar, ManagementNavList, ManagementSidebar, NavSkeleton } from "./sidebar";
import { Topbar } from "./topbar";

function SkipLink() {
  return (
    <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-purple-500 focus:px-5 focus:py-3 focus:text-white">
      Pular para o conteúdo
    </a>
  );
}

/** Ambiente do colaborador: simples, amigável, focado no próprio desenvolvimento. */
export function EmployeeShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SkipLink />
      <div className="mx-auto flex min-h-dvh max-w-[1680px] gap-6 p-4 pb-24 lg:pb-4">
        <EmployeeSidebar />
        <div className="min-w-0 flex-1 lg:pt-2">
          <Logo className="mb-4 h-10 lg:hidden" />
          <Topbar environment="employee" searchPlaceholder="Buscar cursos, trilhas, conteúdos ou pessoas…" />
          <main id="conteudo" tabIndex={-1} className="focus:outline-none">
            {children}
          </main>
        </div>
      </div>
      <EmployeeBottomNav />
    </>
  );
}

/** Ambiente de gestão: ferramentas conforme as permissões do usuário. */
export function ManagementShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SkipLink />
      <div className="mx-auto flex min-h-dvh max-w-[1680px] gap-6 p-4">
        <ManagementSidebar />
        <div className="min-w-0 flex-1 lg:pt-2">
          <Topbar
            environment="management"
            searchPlaceholder="Buscar pessoas, comunicados, pesquisas, páginas…"
            mobileNav={
              <Suspense fallback={<NavSkeleton />}>
                <ManagementNavList />
              </Suspense>
            }
          />
          <main id="conteudo" tabIndex={-1} className="focus:outline-none">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}

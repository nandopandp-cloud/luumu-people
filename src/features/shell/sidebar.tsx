import Link from "next/link";
import type { Route } from "next";
import { Suspense, type ReactNode } from "react";
import { Logo } from "@/design-system/components/brand";
import { Skeleton } from "@/design-system/components/feedback";
import { hasPermissionAnywhere } from "@/server/authz/policy";
import { getCurrentActor } from "@/server/dal";
import { HelpCard } from "./help-card";
import { EMPLOYEE_NAV, EMPLOYEE_NAV_SECONDARY, MANAGEMENT_NAV } from "./nav-config";
import { MobileNavLink, NavLink } from "./nav-link";

function SidebarFrame({ home, children, label }: { home: Route; children: ReactNode; label: string }) {
  return (
    <aside className="sticky top-4 hidden h-[calc(100dvh-2rem)] w-[248px] shrink-0 flex-col rounded-xl border border-line bg-white px-4 pb-4 pt-7 shadow-sm lg:flex">
      <Link href={home} className="mb-7 block self-start rounded-md px-2 focus-visible:outline-2 focus-visible:outline-purple-500">
        <Logo className="h-auto w-[196px]" />
      </Link>
      <nav aria-label={label} className="-mx-1 flex-1 overflow-y-auto px-1">
        {children}
      </nav>
      <div className="pt-4">
        <HelpCard />
      </div>
    </aside>
  );
}

export function EmployeeNavList() {
  return (
    <>
      <ul className="space-y-1">
        {EMPLOYEE_NAV.map((item) => (
          <li key={item.href}>
            <NavLink item={item} />
          </li>
        ))}
      </ul>
      <hr className="mx-3 my-5 border-line" />
      <ul className="space-y-1">
        {EMPLOYEE_NAV_SECONDARY.map((item) => (
          <li key={item.href}>
            <NavLink item={item} />
          </li>
        ))}
      </ul>
    </>
  );
}

export function EmployeeSidebar() {
  return (
    <SidebarFrame home="/inicio" label="Navegação principal">
      <EmployeeNavList />
    </SidebarFrame>
  );
}

export function EmployeeBottomNav() {
  return (
    <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <ul className="flex">
        {[EMPLOYEE_NAV[0]!, EMPLOYEE_NAV[1]!, EMPLOYEE_NAV[2]!, EMPLOYEE_NAV[5]!, EMPLOYEE_NAV_SECONDARY[0]!].map((item) => (
          <li key={item.href} className="flex flex-1">
            <MobileNavLink item={{ ...item, label: item.label === "Meus cursos" ? "Cursos" : item.label === "Meu perfil" ? "Perfil" : item.label }} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Itens da gestão filtrados pelas permissões do ator (a página sempre revalida). */
export async function ManagementNavList() {
  const actor = await getCurrentActor();
  if (!actor) return null;
  const allowed = (anyOf: Parameters<typeof hasPermissionAnywhere>[1][]) => anyOf.some((p) => hasPermissionAnywhere(actor, p));
  if (!hasPermissionAnywhere(actor, "management.access")) {
    return (
      <ul>
        <li>
          <NavLink item={{ href: "/inicio", label: "Minha experiência", icon: "home" }} />
        </li>
      </ul>
    );
  }
  return (
    <ul className="space-y-1">
      {MANAGEMENT_NAV.filter((item) => allowed(item.anyOf)).map((item) => (
        <li key={item.href}>
          <NavLink item={item} />
          {item.children ? (
            <ul className="mt-1 space-y-0.5">
              {item.children
                .filter((child) => allowed(child.anyOf))
                .map((child) => (
                  <li key={child.href}>
                    <NavLink item={child} nested />
                  </li>
                ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function NavSkeleton() {
  return (
    <div className="space-y-2 px-1" aria-hidden>
      {Array.from({ length: 7 }, (_, i) => (
        <Skeleton key={i} className="h-11 rounded-lg" />
      ))}
    </div>
  );
}

export function ManagementSidebar() {
  return (
    <SidebarFrame home="/gestao" label="Navegação da gestão">
      <Suspense fallback={<NavSkeleton />}>
        <ManagementNavList />
      </Suspense>
    </SidebarFrame>
  );
}

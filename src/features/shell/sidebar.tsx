import Link from "next/link";
import type { Route } from "next";
import { Suspense, type ReactNode } from "react";
import { Logo, Mascot } from "@/design-system/components/brand";
import { Skeleton } from "@/design-system/components/feedback";
import { hasPermissionAnywhere } from "@/server/authz/policy";
import { achievementsEnabled, getCurrentActor } from "@/server/dal";
import { HelpCard } from "./help-card";
import { EMPLOYEE_MOBILE_NAV, EMPLOYEE_NAV, EMPLOYEE_NAV_SECONDARY, MANAGEMENT_NAV, type NavItem } from "./nav-config";
import { getEnabledModules, type EnabledModules } from "@/server/modules/flags/modules";
import { MobileNavLink, MobileNavLinkView, NavLink, NavLinkView } from "./nav-link";
import { SidebarToggle } from "./sidebar-toggle";

function SidebarFrame({ home, children, label, id }: { home: Route; children: ReactNode; label: string; id: string }) {
  return (
    <aside
      id={id}
      className="sticky top-4 hidden h-[calc(100dvh-2rem)] w-[248px] shrink-0 flex-col rounded-xl border border-line bg-white px-4 pb-4 pt-7 shadow-sm transition-[width,padding] duration-200 ease-out-soft lg:flex sidebar-collapsed:w-[84px] sidebar-collapsed:px-3"
    >
      <SidebarToggle controls={id} />
      <Link href={home} className="mb-7 block self-start rounded-md px-2 focus-visible:outline-2 focus-visible:outline-purple-500 sidebar-collapsed:self-center sidebar-collapsed:px-0">
        <Logo className="h-auto w-[196px] sidebar-collapsed:hidden" />
        <Mascot className="hidden h-11 sidebar-collapsed:block" label="Luumu People — início" />
      </Link>
      <nav aria-label={label} className="-mx-1 flex-1 overflow-y-auto px-1 sidebar-collapsed:overflow-visible">
        {children}
      </nav>
      <div className="pt-4">
        <HelpCard />
      </div>
    </aside>
  );
}

const visible = (items: NavItem[], modules: EnabledModules) => items.filter((item) => !item.module || modules[item.module]);
const NO_MODULES: EnabledModules = { learning: false, library: false };

function EmployeeNavItems({ live, modules, achievements = false }: { live: boolean; modules: EnabledModules; achievements?: boolean }) {
  const Item = live ? NavLink : NavLinkView;
  const secondary = EMPLOYEE_NAV_SECONDARY.filter((item) => achievements || item.href !== "/minhas-conquistas");
  return (
    <>
      <ul className="space-y-1">
        {visible(EMPLOYEE_NAV, modules).map((item) => (
          <li key={item.href}>
            <Item item={item} />
          </li>
        ))}
      </ul>
      <hr className="mx-3 my-5 border-line sidebar-collapsed:mx-1" />
      <ul className="space-y-1">
        {secondary.map((item) => (
          <li key={item.href}>
            <Item item={item} />
          </li>
        ))}
      </ul>
    </>
  );
}

/** Itens dependem dos módulos ligados (flags), da flag `gamification` e da URL: ficam atrás de <Suspense>. */
async function LiveEmployeeNavItems() {
  const actor = await getCurrentActor();
  const [modules, achievements] = await Promise.all([actor ? getEnabledModules(actor) : NO_MODULES, achievementsEnabled()]);
  return <EmployeeNavItems live modules={modules} achievements={achievements} />;
}

export function EmployeeNavList() {
  return (
    <Suspense fallback={<EmployeeNavItems live={false} modules={NO_MODULES} />}>
      <LiveEmployeeNavItems />
    </Suspense>
  );
}

export function EmployeeSidebar() {
  return (
    <SidebarFrame home="/inicio" label="Navegação principal" id="sidebar-colaborador">
      <EmployeeNavList />
    </SidebarFrame>
  );
}

const MOBILE_ITEMS = EMPLOYEE_MOBILE_NAV;

function BottomNavItems({ live }: { live: boolean }) {
  const Item = live ? MobileNavLink : MobileNavLinkView;
  return (
    <ul className="flex">
      {MOBILE_ITEMS.map((item) => (
        <li key={item.href} className="flex flex-1">
          <Item item={item} />
        </li>
      ))}
    </ul>
  );
}

export function EmployeeBottomNav() {
  return (
    <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <Suspense fallback={<BottomNavItems live={false} />}>
        <BottomNavItems live />
      </Suspense>
    </nav>
  );
}

/** Itens da gestão filtrados pelas permissões do ator (a página sempre revalida). */
export async function ManagementNavList() {
  const actor = await getCurrentActor();
  if (!actor) return null;
  const modules = await getEnabledModules(actor);
  const allowed = (anyOf: Parameters<typeof hasPermissionAnywhere>[1][], module?: keyof EnabledModules) =>
    (!module || modules[module]) && anyOf.some((p) => hasPermissionAnywhere(actor, p));
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
      {MANAGEMENT_NAV.filter((item) => allowed(item.anyOf, item.module) && (!item.children || item.children.some((c) => allowed(c.anyOf, c.module)))).map((item) => (
        <li key={item.href}>
          <NavLink item={item} />
          {item.children ? (
            <ul className="mt-1 space-y-0.5 sidebar-collapsed:hidden">
              {item.children
                .filter((child) => allowed(child.anyOf, child.module))
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
    <SidebarFrame home="/gestao" label="Navegação da gestão" id="sidebar-gestao">
      <Suspense fallback={<NavSkeleton />}>
        <ManagementNavList />
      </Suspense>
    </SidebarFrame>
  );
}

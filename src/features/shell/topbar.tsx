import { Bell } from "lucide-react";
import { Suspense, type ReactNode } from "react";
import { Skeleton } from "@/design-system/components/feedback";
import { hasPermissionAnywhere } from "@/server/authz/policy";
import { getCurrentActor } from "@/server/dal";
import { getMyProfile } from "@/server/modules/people/service";
import { CommandPalette } from "@/features/search/command-palette";
import { MobileMenuButton } from "./mobile-menu";
import { UserMenu } from "./user-menu";

/**
 * Barra superior: busca, notificações e conta. A parte que depende da sessão
 * fica atrás de <Suspense> (Cache Components: o resto vai no static shell).
 */
export function Topbar({
  searchPlaceholder,
  environment,
  mobileNav,
}: {
  searchPlaceholder: string;
  environment: "employee" | "management";
  /** Navegação exibida na gaveta mobile (somente gestão; colaborador usa a barra inferior). */
  mobileNav?: ReactNode;
}) {
  return (
    <header className="flex items-center gap-3 pb-6 sm:gap-4">
      {mobileNav ? <MobileMenuButton>{mobileNav}</MobileMenuButton> : null}
      <CommandPalette placeholder={searchPlaceholder} context={environment} />
      <div className="ml-auto flex items-center gap-3 sm:gap-5">
        <button
          type="button"
          aria-label="Notificações"
          className="relative flex size-12 items-center justify-center rounded-full border border-line bg-white text-neutral-700 shadow-sm transition-colors hover:text-purple-600 focus-visible:outline-2 focus-visible:outline-purple-500"
        >
          <Bell aria-hidden className="size-5" />
        </button>
        <span aria-hidden className="hidden h-10 w-px bg-line sm:block" />
        <Suspense fallback={<UserMenuSkeleton />}>
          <TopbarUser environment={environment} />
        </Suspense>
      </div>
    </header>
  );
}

async function TopbarUser({ environment }: { environment: "employee" | "management" }) {
  const actor = await getCurrentActor();
  if (!actor) return null;
  const profile = await getMyProfile(actor);
  return (
    <UserMenu
      name={profile.preferredName || profile.name}
      subtitle={profile.position ?? profile.orgUnit ?? ""}
      image={profile.image}
      environment={environment}
      canManage={hasPermissionAnywhere(actor, "management.access")}
    />
  );
}

function UserMenuSkeleton() {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <Skeleton className="size-12 rounded-full" />
      <div className="hidden space-y-1.5 sm:block">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

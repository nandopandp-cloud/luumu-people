"use client";

import { ArrowLeftRight, ChevronDown, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Avatar } from "@/design-system/components/avatar";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/design-system/components/menu";
import { authClient } from "@/lib/auth-client";

export type UserMenuProps = {
  name: string;
  subtitle: string;
  image: string | null;
  /** Ambiente atual e se o usuário pode alternar para o outro. */
  environment: "employee" | "management";
  canManage: boolean;
};

export function UserMenu({ name, subtitle, image, environment, canManage }: UserMenuProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function signOut() {
    startTransition(async () => {
      await authClient.signOut();
      router.replace("/entrar");
      router.refresh();
    });
  }

  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-3 rounded-full py-1 pl-1 pr-2 text-left transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-purple-500"
          aria-label={`Menu da conta de ${name}`}
        >
          <Avatar name={name} src={image} size="lg" />
          <span className="hidden min-w-0 sm:block">
            <span className="block max-w-44 truncate text-body-sm font-semibold text-neutral-900">{name}</span>
            <span className="block max-w-44 truncate text-caption text-neutral-600">{subtitle}</span>
          </span>
          <ChevronDown aria-hidden className="size-4 text-neutral-600" />
        </button>
      </MenuTrigger>
      <MenuContent>
        <MenuLabel>Minha conta</MenuLabel>
        <MenuItem asChild>
          <Link href="/meu-perfil">
            <UserRound aria-hidden /> Meu perfil
          </Link>
        </MenuItem>
        {canManage ? (
          <MenuItem asChild>
            <Link href={environment === "employee" ? "/gestao" : "/inicio"}>
              <ArrowLeftRight aria-hidden />
              {environment === "employee" ? "Ir para a gestão" : "Ir para minha experiência"}
            </Link>
          </MenuItem>
        ) : null}
        <MenuSeparator />
        <MenuItem onSelect={(e) => { e.preventDefault(); signOut(); }} disabled={pending} className="text-red-600 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-700">
          <LogOut aria-hidden /> {pending ? "Saindo…" : "Sair"}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

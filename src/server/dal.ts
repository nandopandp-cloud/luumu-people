import "server-only";
import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";
import { resolveActor, type AuthenticatedActor } from "@/server/auth/session";
import type { Permission } from "@/server/authz/permissions";
import { hasPermissionAnywhere } from "@/server/authz/policy";

/**
 * Data Access Layer para Server Components. Lê a sessão uma vez por request
 * (React cache). Deve ser chamada dentro de um <Suspense> (Cache Components).
 */
export const getCurrentActor = cache(async (): Promise<AuthenticatedActor | null> => resolveActor(await headers()));

export async function requireActor(): Promise<AuthenticatedActor> {
  const actor = await getCurrentActor();
  if (!actor) redirect("/entrar");
  return actor;
}

/** Exige a permissão em ALGUM escopo; a checagem por recurso fica nos serviços. */
export async function requirePermission(permission: Permission): Promise<AuthenticatedActor> {
  const actor = await requireActor();
  if (!hasPermissionAnywhere(actor, permission)) forbidden();
  return actor;
}

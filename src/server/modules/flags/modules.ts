import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { AuthenticatedActor } from "@/server/auth/session";
import { HttpError } from "@/server/http/errors";
import { effectiveFlags } from "./service";

/**
 * Módulos do produto ligados por feature flag (padrão: desligados).
 * Módulo desligado: some da navegação, dos atalhos e da Início; páginas e
 * APIs respondem 404. Nada é apagado — religar a flag devolve tudo.
 */
export const MODULE_FLAGS = { learning: "module_learning", library: "module_library" } as const;
export type ModuleKey = keyof typeof MODULE_FLAGS;
export type EnabledModules = Record<ModuleKey, boolean>;

export const getEnabledModules = cache(async (actor: AuthenticatedActor): Promise<EnabledModules> => {
  const flags = await effectiveFlags(actor);
  return { learning: flags[MODULE_FLAGS.learning] ?? false, library: flags[MODULE_FLAGS.library] ?? false };
});

/** Páginas (Server Components). */
export async function requireModule(actor: AuthenticatedActor, key: ModuleKey): Promise<void> {
  if (!(await getEnabledModules(actor))[key]) notFound();
}

/** Serviços/APIs. */
export async function assertModule(actor: AuthenticatedActor, key: ModuleKey): Promise<void> {
  if (!(await getEnabledModules(actor))[key]) throw new HttpError(404, "Não encontrado", "Este recurso não está disponível.");
}

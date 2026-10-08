import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ModulePage } from "@/features/page/module-page";
import { achievementsEnabled, requireActor } from "@/server/dal";

export const metadata: Metadata = { title: "Minhas conquistas" };

/** Oculta enquanto a flag `gamification` estiver desligada (padrão). */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <Achievements />
    </Suspense>
  );
}

async function Achievements() {
  await requireActor();
  if (!(await achievementsEnabled())) notFound();
  return (
    <ModulePage
      title="Minhas conquistas"
      description="Cada aprendizado, cada ação e cada atitude te aproxima de uma versão ainda melhor. Continue assim!"
      soon={{
        title: "Suas conquistas vão brilhar aqui",
        description: "Nível, XP, selos, desafios e marcos da sua jornada de aprendizagem.",
        phase: "Chega na Fase 2 · Experiência do colaborador",
      }}
    />
  );
}

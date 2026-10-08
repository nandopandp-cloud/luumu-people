import type { Metadata } from "next";
import { ModulePage } from "@/features/page/module-page";

export const metadata: Metadata = { title: "Comunicados" };

export default function Page() {
  return (
    <ModulePage
      title="Comunicados"
      description="Fique por dentro das novidades, iniciativas e tudo o que acontece na nossa empresa."
      bubble="Informação também aproxima pessoas!"
      soon={{
        title: "O mural da empresa está chegando",
        description: "Destaques, eventos, links rápidos e comunicados para você e para a sua área.",
        phase: "Chega na Fase 2 · Experiência do colaborador",
      }}
    />
  );
}

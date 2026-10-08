import type { Metadata } from "next";
import { ModulePage } from "@/features/page/module-page";

export const metadata: Metadata = { title: "Meus cursos" };

export default function Page() {
  return (
    <ModulePage
      title="Meus cursos"
      description="Acompanhe seus treinamentos, continue de onde parou e descubra novos conteúdos."
      bubble="Aprender hoje constrói o seu próximo amanhã."
      soon={{
        title: "Seus cursos vão aparecer aqui",
        description: "Em breve você vai acompanhar cursos em andamento, obrigatórios e concluídos, com prazos e progresso.",
        phase: "Chega na Fase 2 · Experiência do colaborador",
      }}
    />
  );
}

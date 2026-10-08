"use client";

import { Award, CheckCircle2 } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/design-system/components/button";
import { Modal } from "@/design-system/components/dialog";
import { useToast } from "@/design-system/components/toast";
import { api } from "@/lib/api-client";

type Result = { progress: number; completed: boolean; certificate: string | null; nextLessonId: string | null };

/** Conclui a aula e avança; ao terminar o curso, celebra e oferece o certificado. */
export function CompleteLessonButton({ courseId, lessonId, done, nextLessonId }: { courseId: string; lessonId: string; done: boolean; nextLessonId: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [finished, setFinished] = useState(false);

  function complete() {
    startTransition(async () => {
      try {
        const result = await api<Result>(`/api/v1/courses/${courseId}/lessons/${lessonId}/complete`, { method: "POST" });
        if (result.completed && !done && !nextLessonId) {
          setFinished(true);
          router.refresh();
          return;
        }
        router.push((result.nextLessonId ? `/meus-cursos/${courseId}/aulas/${result.nextLessonId}` : `/meus-cursos/${courseId}`) as Route);
        router.refresh();
      } catch {
        toast({ tone: "error", title: "Não foi possível registrar a conclusão", description: "Verifique sua conexão e tente novamente." });
      }
    });
  }

  return (
    <>
      <Button onClick={complete} loading={pending} size="lg">
        <CheckCircle2 aria-hidden />
        {done ? (nextLessonId ? "Próxima aula" : "Voltar ao curso") : nextLessonId ? "Concluir e avançar" : "Concluir curso"}
      </Button>
      <Modal
        open={finished}
        onOpenChange={setFinished}
        title="Parabéns, curso concluído! 🎉"
        description="Seu certificado já está disponível. Continue assim!"
        footer={
          <>
            <Button variant="ghost" asChild>
              <Link href={"/meus-cursos" as Route}>Voltar aos cursos</Link>
            </Button>
            <Button asChild>
              <Link href={`/certificados/${courseId}` as Route}>
                <Award aria-hidden /> Ver certificado
              </Link>
            </Button>
          </>
        }
      >
        <p className="text-body-sm text-neutral-600">Cada aprendizado te aproxima de uma versão ainda melhor. O certificado fica guardado no seu perfil.</p>
      </Modal>
    </>
  );
}

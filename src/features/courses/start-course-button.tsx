"use client";

import { Play } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/design-system/components/button";
import { useToast } from "@/design-system/components/toast";
import { api } from "@/lib/api-client";

/** Inicia (matrícula voluntária) ou continua um curso e leva para a próxima aula. */
export function StartCourseButton({ courseId, label, variant = "primary", size = "sm" }: { courseId: string; label: string; variant?: "primary" | "soft"; size?: "sm" | "md" | "lg" }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant={variant}
      size={size}
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            const { nextLessonId } = await api<{ nextLessonId: string | null }>(`/api/v1/courses/${courseId}/enroll`, { method: "POST" });
            router.push((nextLessonId ? `/meus-cursos/${courseId}/aulas/${nextLessonId}` : `/meus-cursos/${courseId}`) as Route);
          } catch {
            toast({ tone: "error", title: "Não foi possível abrir o curso", description: "Tente novamente em instantes." });
          }
        })
      }
    >
      <Play aria-hidden className="fill-current" /> {label}
    </Button>
  );
}

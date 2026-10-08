import type { PathStatus } from "@/server/modules/learning/service";

export const PATH_STATUS: Record<PathStatus, { label: string; tone: "neutral" | "orange" | "green" }> = {
  not_started: { label: "Não iniciada", tone: "neutral" },
  in_progress: { label: "Em andamento", tone: "orange" },
  completed: { label: "Concluída", tone: "green" },
};

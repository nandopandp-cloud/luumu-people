import { BookOpen, PlayCircle } from "lucide-react";
import type { Route } from "next";
import { cn } from "@/design-system/cn";

/** Link do conteúdo sugerido: trilha ou curso do catálogo. */
export const suggestionHref = (item: { kind: "course" | "path"; id: string }) => (item.kind === "path" ? `/trilhas/${item.id}` : `/meus-cursos/${item.id}`) as Route;

export function SuggestionIcon({ kind }: { kind: "course" | "path" }) {
  return (
    <span aria-hidden className={cn("flex size-11 shrink-0 items-center justify-center rounded-lg", kind === "course" ? "bg-purple-100 text-purple-600" : "bg-green-100 text-green-700")}>
      {kind === "course" ? <PlayCircle className="size-6" /> : <BookOpen className="size-6" />}
    </span>
  );
}

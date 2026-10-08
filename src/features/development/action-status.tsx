"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useToast } from "@/design-system/components/toast";
import { cn } from "@/design-system/cn";
import { api } from "@/lib/api-client";
import { ACTION_STATUS_LABEL } from "./labels";

const TONE: Record<string, string> = {
  not_started: "bg-neutral-100 text-neutral-700",
  in_progress: "bg-blue-100 text-blue-700",
  done: "bg-green-100 text-green-800",
  cancelled: "bg-neutral-100 text-neutral-500 line-through",
};

/** Seletor de status da ação. "Concluída" usa o diálogo com evidência (CompleteActionDialog). */
export function ActionStatusSelect({ actionId, status, title }: { actionId: string; status: string; title: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const options = status === "done" ? ["done", "in_progress", "not_started"] : ["not_started", "in_progress", "cancelled"];
  return (
    <select
      aria-label={`Status da ação ${title}`}
      value={status}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        startTransition(async () => {
          try {
            await api(`/api/v1/development/actions/${actionId}`, { method: "PATCH", body: { status: next } });
            router.refresh();
          } catch {
            toast({ tone: "error", title: "Não foi possível atualizar o status." });
          }
        });
      }}
      className={cn("h-8 cursor-pointer appearance-none rounded-full border-0 px-3 text-caption font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400", TONE[status])}
    >
      {options.map((value) => (
        <option key={value} value={value}>
          {ACTION_STATUS_LABEL[value]}
        </option>
      ))}
    </select>
  );
}

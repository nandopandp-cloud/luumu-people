"use client";

import { Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/design-system/components/button";
import { useToast } from "@/design-system/components/toast";
import { api, ApiError } from "@/lib/api-client";

/** Encerra a pesquisa e libera o último lote de respostas. */
export function CloseSurveyButton({ surveyId }: { surveyId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      loading={pending}
      onClick={() => {
        if (!window.confirm("Encerrar a pesquisa agora? Ninguém mais poderá responder.")) return;
        startTransition(async () => {
          try {
            await api(`/api/v1/surveys/${surveyId}/close`, { method: "POST" });
            toast({ tone: "success", title: "Pesquisa encerrada" });
            router.refresh();
          } catch (e) {
            toast({ tone: "error", title: "Não foi possível encerrar", description: e instanceof ApiError ? e.message : "Tente novamente." });
          }
        });
      }}
    >
      <Square aria-hidden /> Encerrar pesquisa
    </Button>
  );
}

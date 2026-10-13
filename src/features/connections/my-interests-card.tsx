"use client";

import { Pencil, Sparkles } from "lucide-react";
import { Button } from "@/design-system/components/button";
import { Card, CardHeader } from "@/design-system/components/card";
import { InterestChip } from "./interest-icon";
import { InterestsDialog } from "./interests-dialog";

/** Cartão "Meus interesses" do próprio perfil (afinidades em Conexões). */
export function MyInterestsCard({ interests }: { interests: string[] }) {
  return (
    <Card>
      <CardHeader
        title="Meus interesses"
        description="Mostram afinidades com colegas em Conexões."
        action={
          <InterestsDialog
            initial={interests}
            trigger={
              <Button variant="soft" size="sm">
                {interests.length ? <Pencil aria-hidden /> : <Sparkles aria-hidden />} {interests.length ? "Editar" : "Escolher"}
              </Button>
            }
          />
        }
      />
      {interests.length ? (
        <ul className="flex flex-wrap gap-2">
          {interests.map((k) => (
            <li key={k}>
              <InterestChip interest={k} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-body-sm text-neutral-600">Você ainda não escolheu interesses. Eles ajudam a encontrar pessoas com afinidades com você.</p>
      )}
    </Card>
  );
}

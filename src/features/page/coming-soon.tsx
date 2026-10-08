import type { ReactNode } from "react";
import { Card } from "@/design-system/components/card";
import { EmptyState } from "@/design-system/components/empty-state";

/**
 * Módulo de uma fase futura do roadmap. Honesto com a pessoa usuária: nada de
 * dados fictícios na interface (briefing §50 e Definition of Done).
 */
export function ComingSoon({ title, description, phase }: { title: ReactNode; description: ReactNode; phase: string }) {
  return (
    <Card>
      <EmptyState
        title={title}
        description={
          <>
            {description}
            <span className="mt-2 block text-caption font-medium uppercase tracking-wide text-purple-600">{phase}</span>
          </>
        }
      />
    </Card>
  );
}

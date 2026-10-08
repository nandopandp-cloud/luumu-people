"use client";

import { Button } from "@/design-system/components/button";
import { EmptyState } from "@/design-system/components/empty-state";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[60dvh] items-center justify-center p-6">
      <div className="card w-full max-w-lg p-8">
        <EmptyState
          title="Algo não saiu como esperado"
          description={
            <>
              Tente novamente em instantes. Se continuar acontecendo, informe este código ao suporte:{" "}
              <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-caption">{error.digest ?? "sem código"}</code>
            </>
          }
          action={<Button onClick={reset}>Tentar novamente</Button>}
        />
      </div>
    </main>
  );
}

import Link from "next/link";
import { Button } from "@/design-system/components/button";
import { EmptyState } from "@/design-system/components/empty-state";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="card w-full max-w-lg p-8">
        <EmptyState
          title="Não encontramos esta página"
          description="O endereço pode ter mudado ou a página não está disponível para o seu perfil."
          action={
            <Button asChild>
              <Link href="/inicio">Ir para o início</Link>
            </Button>
          }
        />
      </div>
    </main>
  );
}

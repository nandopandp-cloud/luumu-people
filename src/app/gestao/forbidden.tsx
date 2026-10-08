import Link from "next/link";
import { Button } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { EmptyState } from "@/design-system/components/empty-state";

export default function Forbidden() {
  return (
    <Card>
      <EmptyState
        title="Esta área não está disponível para você"
        description="Seu perfil de acesso não inclui esta funcionalidade. Se você acha que deveria ter acesso, fale com o administrador da plataforma."
        action={
          <Button asChild variant="secondary">
            <Link href="/inicio">Voltar para o início</Link>
          </Button>
        }
      />
    </Card>
  );
}

"use client";

import { Printer } from "lucide-react";
import { Button } from "@/design-system/components/button";

export function PrintButton() {
  return (
    <Button variant="secondary" onClick={() => window.print()}>
      <Printer aria-hidden /> Imprimir ou salvar em PDF
    </Button>
  );
}

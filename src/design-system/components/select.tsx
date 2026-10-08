import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "../cn";
import { controlBase, controlState } from "./field";

/**
 * Select nativo estilizado: melhor acessibilidade e usabilidade no mobile.
 * Para busca e seleção múltipla com chips, use MultiSelect (Fase 2).
 */
export function Select({ className, invalid, children, ...props }: ComponentProps<"select"> & { invalid?: boolean }) {
  return (
    <div className="relative">
      <select aria-invalid={invalid || undefined} className={cn(controlBase, controlState(invalid), "h-11 appearance-none pl-3.5 pr-10", className)} {...props}>
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
    </div>
  );
}

import { ChevronDown } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../cn";
import { controlBase, controlState } from "./field";

/**
 * Select nativo estilizado: melhor acessibilidade e usabilidade no mobile.
 * `leading`: ícone ou marcador decorativo à esquerda (ex.: a cor escolhida).
 * Para busca e seleção múltipla com chips, use MultiSelect (Fase 2).
 */
export function Select({ className, invalid, leading, children, ...props }: ComponentProps<"select"> & { invalid?: boolean; leading?: ReactNode }) {
  return (
    <div className="relative">
      {leading ? (
        <span aria-hidden className={cn("pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center text-neutral-600 [&_svg]:size-[18px]", props.disabled && "opacity-50")}>
          {leading}
        </span>
      ) : null}
      <select aria-invalid={invalid || undefined} className={cn(controlBase, controlState(invalid), "h-11 appearance-none pl-3.5 pr-10", leading && "pl-11", className)} {...props}>
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
    </div>
  );
}

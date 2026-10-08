import type { ComponentProps } from "react";
import { cn } from "../cn";

/**
 * Tabela semântica. Em telas pequenas, use `responsive="cards"` nas linhas
 * (cada célula vira "rótulo: valor" via data-label) — tabelas viram listas.
 */
export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="-mx-6 overflow-x-auto px-6">
      <table className={cn("w-full border-separate border-spacing-0 text-left text-body-sm", className)} {...props} />
    </div>
  );
}

export function Th({ className, ...props }: ComponentProps<"th">) {
  return <th scope="col" className={cn("border-b border-line px-3 py-3 whitespace-nowrap text-caption font-semibold uppercase tracking-wide text-neutral-500 first:pl-0 last:pr-0", className)} {...props} />;
}

export function Td({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("border-b border-line px-3 py-3.5 align-middle text-neutral-700 first:pl-0 last:pr-0 max-md:block max-md:border-0 max-md:px-0 max-md:py-1 max-md:before:mr-2 max-md:before:font-medium max-md:before:text-neutral-500 max-md:before:content-[attr(data-label)]", className)} {...props} />;
}

export function Tr({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("max-md:block max-md:border-b max-md:border-line max-md:py-3 [&:last-child>td]:border-b-0", className)} {...props} />;
}

export function THead({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("max-md:sr-only", className)} {...props} />;
}

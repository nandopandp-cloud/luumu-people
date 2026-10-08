import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge precisa conhecer os tokens customizados do tema; sem isso,
 * `text-h1`/`text-body-sm` seriam tratados como COR e removeriam `text-purple-600`
 * (ou vice-versa) ao combinar classes.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["display", "h1", "h2", "h3", "h4", "body", "body-sm", "caption"],
      radius: ["sm", "md", "lg", "xl", "full"],
      shadow: ["sm", "md", "lg"],
    },
  },
});

/** Combina classes resolvendo conflitos do Tailwind (a última vence). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

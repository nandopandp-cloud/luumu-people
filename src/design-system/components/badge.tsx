import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../cn";

/**
 * Badges e tags — styleguide "05. Badges, tags e status". Cores sempre em pares
 * fundo claro + texto escuro (contraste AA). O significado nunca depende só da
 * cor: o texto do badge sempre descreve o estado.
 */
export const badgeVariants = cva("inline-flex items-center gap-1 whitespace-nowrap rounded-full font-medium [&_svg]:size-3.5", {
  variants: {
    tone: {
      purple: "bg-purple-100 text-purple-600",
      orange: "bg-orange-100 text-orange-700",
      green: "bg-green-100 text-green-700",
      yellow: "bg-yellow-100 text-yellow-700",
      blue: "bg-blue-100 text-blue-700",
      pink: "bg-pink-100 text-pink-700",
      red: "bg-red-100 text-red-700",
      neutral: "bg-neutral-100 text-neutral-600",
    },
    size: {
      sm: "px-2 py-0.5 text-caption",
      md: "px-3 py-1 text-body-sm",
    },
  },
  defaultVariants: { tone: "purple", size: "sm" },
});

export function Badge({ className, tone, size, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}

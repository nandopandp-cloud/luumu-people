import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../cn";
import { Spinner } from "./spinner";

/**
 * Botões — styleguide "01. Botões": Primário, Secundário, Terciário, Fantasma,
 * Destrutivo; estados padrão, hover, ativo e desabilitado.
 */
export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-[background-color,color,border-color,box-shadow] duration-150 ease-out-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500 disabled:pointer-events-none aria-disabled:pointer-events-none [&_svg]:size-[1.1em] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-purple-500 text-white shadow-[0_6px_16px_-6px_rgb(124_58_237/0.55)] hover:bg-purple-600 active:bg-purple-700 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:shadow-none",
        secondary:
          "border border-purple-300 bg-white text-purple-600 hover:bg-purple-50 active:bg-purple-100 disabled:border-neutral-200 disabled:text-neutral-400",
        tertiary: "text-purple-600 hover:text-purple-700 hover:underline underline-offset-4 disabled:text-neutral-400 px-0!",
        soft: "bg-purple-100 text-purple-600 hover:bg-purple-200/70 active:bg-purple-200 disabled:bg-neutral-100 disabled:text-neutral-400",
        ghost: "border border-line bg-white text-neutral-800 hover:bg-neutral-50 active:bg-neutral-100 disabled:text-neutral-400",
        destructive: "border border-red-100 bg-red-50 text-red-600 hover:bg-red-100 active:bg-red-100 disabled:border-neutral-200 disabled:bg-neutral-50 disabled:text-neutral-400",
      },
      size: {
        sm: "h-8 px-3.5 text-caption",
        md: "h-10 px-5 text-body-sm",
        lg: "h-12 px-6 text-body",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Renderiza o filho (ex.: <Link>) com o estilo de botão. */
    asChild?: boolean;
    loading?: boolean;
  };

export function Button({ className, variant, size, block, asChild, loading, disabled, children, ...props }: ButtonProps) {
  const Component = asChild ? Slot.Root : "button";
  return (
    <Component
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <Spinner className="size-4" />
          <span>{children}</span>
        </>
      ) : (
        children
      )}
    </Component>
  );
}

type IconButtonProps = ComponentProps<"button"> & {
  /** Rótulo acessível obrigatório: botões só com ícone precisam de nome. */
  label: string;
  variant?: "plain" | "outline" | "soft";
  size?: "sm" | "md" | "lg";
};

export function IconButton({ label, variant = "outline", size = "md", className, children, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full text-neutral-700 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500 disabled:opacity-40 [&_svg]:size-5",
        variant === "outline" && "border border-line bg-white hover:bg-purple-50 hover:text-purple-600",
        variant === "soft" && "bg-purple-100 text-purple-600 hover:bg-purple-200",
        variant === "plain" && "hover:bg-purple-50 hover:text-purple-600",
        size === "sm" && "size-8 [&_svg]:size-4",
        size === "md" && "size-10",
        size === "lg" && "size-12",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

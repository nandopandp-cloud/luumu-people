import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "../cn";

/** Superfície base: branca, borda suave, raio XL. */
export function Card({ className, as: Tag = "section", ...props }: Omit<ComponentProps<"section">, "ref"> & { as?: "section" | "div" | "article" | "aside" }) {
  return <Tag className={cn("card p-6", className)} {...props} />;
}

/** Cabeçalho de card: título (H3) + ação "Ver todos →" opcional. */
export function CardHeader({ title, action, description, className, id }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string; id?: string }) {
  return (
    <header className={cn("mb-4 flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 id={id} className="text-h3 font-bold tracking-[-0.01em] text-neutral-900">
          {title}
        </h2>
        {description ? <p className="mt-1 text-body-sm text-neutral-500">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function SeeAllLink({ href, children = "Ver todos" }: { href: ComponentProps<typeof Link>["href"]; children?: ReactNode }) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center gap-1 rounded-full text-body-sm font-medium text-purple-600 hover:text-purple-700 hover:underline underline-offset-4">
      {children}
      <ArrowRight aria-hidden className="size-4" />
    </Link>
  );
}

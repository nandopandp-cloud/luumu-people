import type { ReactNode } from "react";
import { cn } from "../cn";
import { Mascot } from "./brand";

/**
 * Estado vazio — styleguide "10. Empty states": mascote, título humano,
 * orientação e próximo passo.
 */
export function EmptyState({ title, description, action, className, compact }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "gap-2 py-6" : "gap-3 py-12", className)}>
      <div className={cn("relative", compact ? "mb-1" : "mb-2")}>
        <div aria-hidden className="absolute inset-x-0 bottom-0 mx-auto h-1/3 w-4/5 rounded-full bg-purple-100 blur-xl" />
        <Mascot className={cn("relative", compact ? "h-16" : "h-24")} />
      </div>
      <p className="text-h4 font-semibold text-neutral-900">{title}</p>
      {description ? <p className="max-w-sm text-body-sm text-neutral-500">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

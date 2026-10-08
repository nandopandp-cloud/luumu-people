import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../cn";

/** Skeleton — estado de carregamento com o formato do conteúdo final. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton rounded-md", className)} />;
}

const alertTones = {
  success: { box: "border-green-100 bg-green-50 text-green-700", icon: CheckCircle2 },
  info: { box: "border-blue-100 bg-blue-50 text-blue-700", icon: Info },
  warning: { box: "border-orange-100 bg-orange-50 text-orange-700", icon: AlertTriangle },
  error: { box: "border-red-100 bg-red-50 text-red-700", icon: XCircle },
} as const;

/** Alertas — styleguide "06. Alertas e mensagens". */
export function Alert({ tone = "info", title, children, className, action }: { tone?: keyof typeof alertTones; title: ReactNode; children?: ReactNode; className?: string; action?: ReactNode }) {
  const { box, icon: Icon } = alertTones[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-lg border px-4 py-3", box, className)}>
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-body-sm font-semibold">{title}</p>
        {children ? <div className="mt-0.5 text-body-sm opacity-90">{children}</div> : null}
      </div>
      {action}
    </div>
  );
}

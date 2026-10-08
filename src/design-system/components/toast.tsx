"use client";

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { Toast as RadixToast } from "radix-ui";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { cn } from "../cn";

/**
 * Toasts (avisos temporários) — styleguide "06. Alertas e mensagens".
 * Anunciados por leitores de tela; erros ficam mais tempo e não somem sozinhos
 * enquanto o ponteiro/foco estiver sobre eles. Use para CONFIRMAR ações; erros
 * de formulário ficam junto ao campo.
 */
type Tone = "success" | "info" | "warning" | "error";
type ToastData = { id: number; tone: Tone; title: string; description?: string };

const tones = {
  success: { box: "border-green-100 bg-green-50 text-green-800", icon: CheckCircle2 },
  info: { box: "border-blue-100 bg-blue-50 text-blue-700", icon: Info },
  warning: { box: "border-orange-100 bg-orange-50 text-orange-700", icon: AlertTriangle },
  error: { box: "border-red-100 bg-red-50 text-red-700", icon: XCircle },
} as const;

const ToastContext = createContext<((toast: Omit<ToastData, "id">) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const show = useCallback((toast: Omit<ToastData, "id">) => setToasts((list) => [...list.slice(-2), { ...toast, id: Date.now() + Math.random() }]), []);

  return (
    <ToastContext value={show}>
      <RadixToast.Provider swipeDirection="right" label="Notificação">
        {children}
        {toasts.map((t) => {
          const { box, icon: Icon } = tones[t.tone];
          return (
            <RadixToast.Root
              key={t.id}
              type={t.tone === "error" ? "foreground" : "background"}
              duration={t.tone === "error" ? 8000 : 4500}
              onOpenChange={(open) => !open && setToasts((list) => list.filter((x) => x.id !== t.id))}
              className={cn("flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg data-[swipe=end]:animate-out", box)}
            >
              <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <RadixToast.Title className="text-body-sm font-semibold">{t.title}</RadixToast.Title>
                {t.description ? <RadixToast.Description className="mt-0.5 text-body-sm opacity-90">{t.description}</RadixToast.Description> : null}
              </div>
              <RadixToast.Close className="rounded-full p-1 opacity-70 hover:opacity-100" aria-label="Fechar">
                <X className="size-4" aria-hidden />
              </RadixToast.Close>
            </RadixToast.Root>
          );
        })}
        <RadixToast.Viewport className="fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2 outline-none max-lg:bottom-24" />
      </RadixToast.Provider>
    </ToastContext>
  );
}

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast precisa estar dentro de <ToastProvider>.");
  return show;
}

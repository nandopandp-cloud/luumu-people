"use client";

import { ArrowRight, Check, Eye, MessageSquareText, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { useEffect, useId, useState, useTransition } from "react";
import { Button } from "@/design-system/components/button";
import { Textarea } from "@/design-system/components/field";
import { cn } from "@/design-system/cn";
import { api, ApiError } from "@/lib/api-client";
import { MOOD_NOTE_MAX, MOODS, moodOf } from "@/lib/moods";
import { OPEN_MOOD, type TodayMoodView } from "./events";
import { MoodArt } from "./mood-art";

/**
 * "Como você está se sentindo hoje?" — aparece sozinho no primeiro acesso do
 * dia (enquanto não houver resposta nem "agora não") e pode ser reaberto de
 * qualquer lugar (topo, menu, home, perfil) para mudar o sentimento do dia.
 */
export function MoodDialogHost({ today }: { today: TodayMoodView }) {
  const router = useRouter();
  const pendingToday = today.mood === null && !today.dismissed;
  const [open, setOpen] = useState(pendingToday);
  const [step, setStep] = useState<"choose" | "thanks">("choose");
  const [selected, setSelected] = useState<number | null>(today.mood);
  const [note, setNote] = useState(today.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(today.dismissed);
  const [saving, startSaving] = useTransition();
  const noteId = useId();

  // O servidor manda o registro novo a cada navegação/refresh (ajuste durante a renderização).
  const [server, setServer] = useState(today);
  if (server !== today && (server.mood !== today.mood || server.note !== today.note || server.dismissed !== today.dismissed)) {
    setServer(today);
    if (!open) {
      setSelected(today.mood);
      setNote(today.note ?? "");
    }
  }

  useEffect(() => {
    const show = () => {
      setStep("choose");
      setError(null);
      setOpen(true);
    };
    window.addEventListener(OPEN_MOOD, show);
    return () => window.removeEventListener(OPEN_MOOD, show);
  }, []);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) return;
    // Fechou o convite do dia sem responder: não reabre sozinho hoje.
    if (step === "choose" && today.mood === null && !dismissed) {
      setDismissed(true);
      void api("/api/v1/me/mood/dismiss", { method: "POST" }).catch(() => null);
    }
    if (step === "thanks") setStep("choose");
  }

  function submit() {
    if (!selected) return setError("Escolha como você está se sentindo.");
    setError(null);
    startSaving(async () => {
      try {
        await api("/api/v1/me/mood", { method: "PUT", body: { mood: selected, note: note.trim() || null } });
        setStep("thanks");
        router.refresh();
      } catch (e) {
        setError(e instanceof ApiError ? (e.fieldErrors[0]?.message ?? e.message) : "Não foi possível registrar agora. Tente novamente.");
      }
    });
  }

  const chosen = moodOf(selected);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-neutral-900/40 backdrop-blur-[3px]" />
        <Dialog.Content
          aria-describedby={step === "choose" ? "humor-descricao" : "humor-obrigado"}
          className="fixed left-1/2 top-1/2 z-50 max-h-[94dvh] w-[calc(100vw-1.5rem)] max-w-[600px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[28px] bg-white shadow-lg focus:outline-none"
        >
          <Dialog.Close
            aria-label="Fechar"
            className="absolute right-4 top-4 z-20 flex size-10 items-center justify-center rounded-full border border-line bg-white/90 text-neutral-700 shadow-sm transition-colors hover:bg-white hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-purple-500 sm:right-5 sm:top-5"
          >
            <X aria-hidden className="size-5" />
          </Dialog.Close>

          {step === "choose" ? (
            <>
              <header className="relative overflow-hidden bg-gradient-to-br from-purple-100 via-purple-50 to-white px-6 pb-12 pt-8 sm:px-10 sm:pt-11">
                <span aria-hidden className="absolute -left-16 top-10 size-56 rounded-full bg-white/60" />
                <MoodArt slug="ola" className="pointer-events-none absolute -bottom-10 right-8 hidden w-48 sm:block" />
                <div className="relative max-w-[19rem] sm:max-w-[22rem]">
                  <Dialog.Title className="text-[1.75rem] font-extrabold leading-[1.08] tracking-[-0.035em] text-neutral-900 sm:text-[2.2rem]">
                    Como você está{" "}
                    <br />
                    <span className="text-purple-500">se sentindo</span> hoje?
                  </Dialog.Title>
                  <Dialog.Description id="humor-descricao" className="mt-3 text-body-sm leading-relaxed text-neutral-600 sm:text-body">
                    Nos conte como você está se sentindo neste momento.
                  </Dialog.Description>
                </div>
              </header>

              <div className="relative -mt-6 rounded-t-[28px] bg-white px-5 pb-6 pt-6 sm:px-10 sm:pb-8">
                <fieldset>
                  <legend className="sr-only">Como você está se sentindo hoje?</legend>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
                    {MOODS.map((m) => {
                      const active = selected === m.value;
                      return (
                        <label
                          key={m.value}
                          className={cn(
                            "group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border-2 bg-gradient-to-b transition-[border-color,box-shadow,transform] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-purple-500",
                            m.card,
                            active ? "border-purple-500 shadow-md" : "border-transparent hover:-translate-y-0.5 hover:shadow-sm",
                          )}
                        >
                          <input type="radio" name="humor" value={m.value} checked={active} onChange={() => setSelected(m.value)} className="absolute inset-0 z-10 size-full cursor-pointer appearance-none rounded-2xl opacity-0" />
                          <span className="relative h-[92px] overflow-hidden sm:h-[104px]">
                            <MoodArt slug={m.slug} className="absolute -bottom-1.5 left-1/2 w-[100px] -translate-x-1/2 transition-transform group-hover:scale-105 sm:w-[112px]" />
                          </span>
                          <span className="relative bg-white/75 px-2 py-2 text-center text-body-sm font-semibold text-neutral-900 backdrop-blur-sm">{m.label}</span>
                          {active ? (
                            <span aria-hidden className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-purple-500 text-white shadow-sm ring-2 ring-white">
                              <Check className="size-4" strokeWidth={3} />
                            </span>
                          ) : null}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="relative mt-5">
                  <label htmlFor={noteId} className="sr-only">
                    Quer compartilhar algo? (opcional)
                  </label>
                  <MessageSquareText aria-hidden className="pointer-events-none absolute left-4 top-3.5 z-10 size-5 text-neutral-500" />
                  <Textarea
                    id={noteId}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={MOOD_NOTE_MAX}
                    rows={2}
                    placeholder="Quer compartilhar algo? (opcional)"
                    aria-describedby={`${noteId}-contador`}
                    className="min-h-[88px] resize-none rounded-xl pb-8 pl-12"
                  />
                  <span id={`${noteId}-contador`} className="pointer-events-none absolute bottom-3 right-14 text-caption tabular-nums text-neutral-500">
                    {note.length}/{MOOD_NOTE_MAX}
                  </span>
                </div>

                {error ? (
                  <p role="alert" className="mt-3 text-body-sm font-medium text-red-600">
                    {error}
                  </p>
                ) : null}

                <div className="mt-5 flex flex-col-reverse items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-center gap-2 text-caption text-neutral-600 sm:text-body-sm">
                    <Eye aria-hidden className="size-[18px] shrink-0" />
                    Seu sentimento e o comentário ficam visíveis para a empresa hoje.
                  </p>
                  <Button size="lg" onClick={submit} loading={saving} className="h-12 shrink-0 rounded-xl px-8">
                    Enviar <ArrowRight aria-hidden />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="px-6 pb-8 pt-10 text-center sm:px-12 sm:pb-10">
              {chosen ? <MoodArt slug={chosen.slug} className="mx-auto w-44 sm:w-52" /> : null}
              <Dialog.Title className="mt-4 text-[1.6rem] font-extrabold tracking-[-0.03em] text-neutral-900">Obrigado por compartilhar</Dialog.Title>
              <Dialog.Description id="humor-obrigado" className="mx-auto mt-3 max-w-sm text-body leading-relaxed text-neutral-600">
                Sua resposta foi registrada. Cuidar de você também faz parte de um ambiente melhor para todos. <span aria-hidden>💜</span>
              </Dialog.Description>
              <Dialog.Close asChild>
                <Button size="lg" block className="mt-7 h-12 rounded-xl">
                  Continuar
                </Button>
              </Dialog.Close>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

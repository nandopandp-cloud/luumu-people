"use client";

import { useSyncExternalStore } from "react";

/**
 * Estado do chat flutuante (dock): a lista de conversas aberta ou fechada e as
 * janelas de conversa (abertas ou minimizadas), da mais recente para a mais
 * antiga. Vive no layout — continua ao navegar — e fica guardado na sessão
 * do navegador (sobrevive a recarregar a página; some ao fechar a aba).
 */

export type DockWindow = { id: string; minimized: boolean };
/**
 * `hiddenAt`: a pessoa fechou o widget (X) neste instante. Ele fica escondido
 * até ela iniciar uma conversa ou receber uma mensagem depois disso.
 */
export type DockState = { listOpen: boolean; windows: DockWindow[]; hiddenAt: string | null };

/** Janelas guardadas (as que não cabem na tela ficam fora até haver espaço). */
const MAX_WINDOWS = 3;
const KEY = "luumu:chat-dock";
const EMPTY: DockState = { listOpen: false, windows: [], hiddenAt: null };

let state: DockState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as DockState | null;
    if (saved && Array.isArray(saved.windows)) {
      state = {
        listOpen: Boolean(saved.listOpen),
        hiddenAt: typeof saved.hiddenAt === "string" && !Number.isNaN(Date.parse(saved.hiddenAt)) ? saved.hiddenAt : null,
        windows: saved.windows.filter((w) => typeof w?.id === "string" && /^[0-9a-f-]{36}$/.test(w.id)).slice(0, MAX_WINDOWS).map((w) => ({ id: w.id, minimized: Boolean(w.minimized) })),
      };
    }
  } catch {
    /* sem armazenamento (janela anônima, bloqueio): começa vazio */
  }
}

function set(next: DockState) {
  state = next;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* segue sem guardar */
  }
  for (const listener of listeners) listener();
}

export const chatDock = {
  /** Abre (ou traz para a frente, restaurada) a conversa numa janela flutuante — e mostra o widget, se estava escondido. */
  open(id: string) {
    load();
    set({ ...state, hiddenAt: null, windows: [{ id, minimized: false }, ...state.windows.filter((w) => w.id !== id)].slice(0, MAX_WINDOWS) });
  },
  /** O X do widget: some (lista e janelas) até chegar ou ser iniciada uma conversa. */
  hide() {
    load();
    set({ listOpen: false, windows: [], hiddenAt: new Date().toISOString() });
  },
  show() {
    load();
    if (state.hiddenAt) set({ ...state, hiddenAt: null });
  },
  close(id: string) {
    load();
    if (state.windows.some((w) => w.id === id)) set({ ...state, windows: state.windows.filter((w) => w.id !== id) });
  },
  toggleMinimized(id: string) {
    load();
    set({ ...state, windows: state.windows.map((w) => (w.id === id ? { ...w, minimized: !w.minimized } : w)) });
  },
  setListOpen(open: boolean) {
    load();
    if (state.listOpen !== open) set({ ...state, listOpen: open });
  },
};

function subscribe(listener: () => void) {
  load();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useChatDock(): DockState {
  return useSyncExternalStore(
    subscribe,
    () => {
      load();
      return state;
    },
    () => EMPTY,
  );
}

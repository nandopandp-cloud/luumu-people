"use client";

import { useSyncExternalStore } from "react";

/**
 * Estado do chat flutuante (dock): a lista de conversas aberta ou fechada e as
 * janelas de conversa (abertas ou minimizadas), da mais recente para a mais
 * antiga. Vive no layout — continua ao navegar — e fica guardado na sessão
 * do navegador (sobrevive a recarregar a página; some ao fechar a aba).
 */

export type DockWindow = { id: string; minimized: boolean };
export type DockState = { listOpen: boolean; windows: DockWindow[] };

/** Janelas guardadas (as que não cabem na tela ficam fora até haver espaço). */
const MAX_WINDOWS = 3;
const KEY = "luumu:chat-dock";
const EMPTY: DockState = { listOpen: false, windows: [] };

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
  /** Abre (ou traz para a frente, restaurada) a conversa numa janela flutuante. */
  open(id: string) {
    load();
    set({ ...state, windows: [{ id, minimized: false }, ...state.windows.filter((w) => w.id !== id)].slice(0, MAX_WINDOWS) });
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

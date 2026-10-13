"use client";

import { useEffect, useState } from "react";
import { friendsApi } from "./client";
import type { PersonCard } from "./types";

const DEBOUNCE_MS = 250;
const LIMIT = 30;

/**
 * Busca de colegas ativos da empresa (conexões e pedidos primeiro) para iniciar
 * conversas e montar grupos. `null` enquanto carrega.
 */
export function useColleagueSearch(search: string, enabled = true) {
  const [result, setResult] = useState<{ term: string; items: PersonCard[] } | null>(null);
  const term = search.trim();
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const timer = setTimeout(
      () => {
        friendsApi
          .people(term, LIMIT)
          .then((r) => alive && setResult({ term, items: r.items }))
          .catch(() => alive && setResult({ term, items: [] }));
      },
      result ? DEBOUNCE_MS : 0,
    );
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `result` só decide o atraso da primeira busca
  }, [term, enabled]);
  return { people: result?.items ?? null, pending: result === null || result.term !== term };
}

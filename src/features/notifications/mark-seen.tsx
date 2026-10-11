"use client";

import { useEffect } from "react";
import { sendRead } from "./labels";

/** Ao abrir o conteúdo, marca como lida a notificação dele (ex.: "Novo comunicado"). */
export function MarkSeen({ keys }: { keys: string[] }) {
  const joined = keys.join(",");
  useEffect(() => {
    if (joined) void sendRead(joined.split(","));
  }, [joined]);
  return null;
}

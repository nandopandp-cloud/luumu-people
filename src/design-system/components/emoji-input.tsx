"use client";

import { useImperativeHandle, useRef, type ComponentProps } from "react";
import { EmojiInsertButton } from "./emoji-picker";
import { Input } from "./field";

/** Input de texto livre (títulos) com o botão de emoji à direita. */
export function EmojiInput({ ref, disabled, readOnly, ...props }: Omit<ComponentProps<typeof Input>, "trailing">) {
  const inner = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inner.current!, []);
  return <Input ref={inner} disabled={disabled} readOnly={readOnly} trailing={<EmojiInsertButton target={inner} disabled={disabled || readOnly} />} {...props} />;
}

"use client";

import { useImperativeHandle, useRef, type ComponentProps } from "react";
import { cn } from "../cn";
import { controlBase, controlState } from "./control";
import { EmojiInsertButton } from "./emoji-picker";

/**
 * Textarea — styleguide "03. Textarea". Traz o botão de emoji no canto inferior
 * direito (insere no cursor); `emoji={false}` para campos em que não cabe.
 */
export function Textarea({ className, invalid, emoji = true, ref, disabled, readOnly, ...props }: ComponentProps<"textarea"> & { invalid?: boolean; emoji?: boolean }) {
  const inner = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => inner.current!, []);
  const control = (
    <textarea
      ref={inner}
      aria-invalid={invalid || undefined}
      disabled={disabled}
      readOnly={readOnly}
      className={cn(controlBase, controlState(invalid), "min-h-24 resize-y px-3.5 py-3", emoji && "pr-12", className)}
      {...props}
    />
  );
  if (!emoji) return control;
  return (
    <div className="relative">
      {control}
      <EmojiInsertButton target={inner} disabled={disabled || readOnly} className="absolute bottom-2.5 right-3" />
    </div>
  );
}

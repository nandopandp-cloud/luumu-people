import type { Route } from "next";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { cn } from "@/design-system/cn";
import { parseRichText, type Inline } from "@/lib/rich-text";

function renderInline(nodes: Inline[]): ReactNode {
  return nodes.map((n, i) => {
    switch (n.type) {
      case "text":
        return <Fragment key={i}>{n.value}</Fragment>;
      case "strong":
        return <strong key={i} className="font-semibold text-neutral-900">{renderInline(n.children)}</strong>;
      case "em":
        return <em key={i}>{renderInline(n.children)}</em>;
      case "u":
        return <u key={i} className="underline-offset-2">{renderInline(n.children)}</u>;
      case "link":
        return n.href.startsWith("https://") ? (
          <a key={i} href={n.href} target="_blank" rel="noopener noreferrer" className="font-medium text-purple-600 underline underline-offset-2 hover:text-purple-700">
            {renderInline(n.children)}
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
        ) : (
          <Link key={i} href={n.href as Route} className="font-medium text-purple-600 underline underline-offset-2 hover:text-purple-700">
            {renderInline(n.children)}
          </Link>
        );
    }
  });
}

/** Texto formatado de um comunicado (ver src/lib/rich-text.ts). Nunca usa HTML bruto. */
export function RichText({ source, className }: { source: string; className?: string }) {
  const blocks = parseRichText(source);
  if (blocks.length === 0) return null;
  return (
    <div className={cn("space-y-4 text-body leading-relaxed text-neutral-800", className)}>
      {blocks.map((b, i) => {
        if (b.type === "h2") return <h2 key={i} className="pt-2 text-h3 font-bold text-neutral-900">{renderInline(b.children)}</h2>;
        if (b.type === "h3") return <h3 key={i} className="text-h4 font-bold text-neutral-900">{renderInline(b.children)}</h3>;
        if (b.type === "ul" || b.type === "ol") {
          const List = b.type;
          return (
            <List key={i} className={cn("space-y-1 pl-6", b.type === "ul" ? "list-disc" : "list-decimal")}>
              {b.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </List>
          );
        }
        if (b.type !== "p") return null;
        return (
          <p key={i}>
            {b.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 ? <br /> : null}
                {renderInline(line)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

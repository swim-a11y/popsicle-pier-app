import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Small labels. "highlight" is the sun: one per screen at most. */
export function Tag({ children, tone = "plain", className }: { children: ReactNode; tone?: "plain" | "highlight" | "mark" | "notice"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center self-start rounded-pill px-3 py-0.5 text-body font-strong",
        tone === "plain" && "border-2 border-line bg-surface text-foreground",
        tone === "highlight" && "bg-highlight text-on-highlight",
        tone === "mark" && "bg-mark text-on-mark",
        tone === "notice" && "bg-notice text-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

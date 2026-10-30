"use client";

import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";

import { PageTitle, ScreenShell } from "@/components/shell/screen-shell";

const ITEMS = [
  { href: "/more/lessons", title: "Lesson dates", line: "The weeks ahead for each swimmer, with closed days." },
  { href: "/more/bills", title: "Bills", line: "Each month's bill, with the bank draft and card price on every line." },
  { href: "/more/messages", title: "Messages", line: "Send a note about a lesson, and answer the school." },
];

export function MoreScreen() {
  return (
    <ScreenShell id="more">
      <PageTitle>More</PageTitle>
      <ul className="flex flex-col gap-3">
        {ITEMS.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="flex min-h-tap-big items-center justify-between gap-3 rounded-card bg-surface px-4 py-3 text-foreground no-underline shadow-card">
              <span className="flex flex-col">
                <span className="font-strong text-heading">{item.title}</span>
                <span>{item.line}</span>
              </span>
              <ChevronRightIcon className="size-6 shrink-0 text-primary" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </ScreenShell>
  );
}

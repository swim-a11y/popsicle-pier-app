"use client";

import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";
import type { ReactNode } from "react";

import { OWNER_TABS, PARENT_TABS, TabBar } from "@/components/shell/tab-bar";
import { SHORT_NAME } from "@/content/brand";
import { useGo } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { SANDBOX } from "@/sandbox";
import { SandboxPill } from "@/sandbox/sandbox-pill";
import { screenById } from "@/screens";

export interface ScreenShellProps {
  id: string;
  /** Flow screens: where the Back arrow goes (one step back). */
  backHref?: string | null;
  /** "Step 3 of 9" */
  step?: { n: number; total: number } | null;
  /** The screen ends with a PinnedBar: no spare space under it. */
  pinned?: boolean;
  children: ReactNode;
}

export function ScreenShell({ id, backHref, step, pinned, children }: ScreenShellProps) {
  const screen = screenById(id);
  const go = useGo();
  const withTabs = screen.shell === "tabs" || screen.shell === "owner";
  return (
    <>
      <main className={cn("mx-auto flex w-full max-w-page flex-col px-gutter", withTabs ? "pb-[calc(var(--spacing-tab-bar)+2.5rem)]" : pinned ? "pb-0" : "pb-12")}>
        <div className="flex min-h-tap-big items-center gap-2 pt-2">
          {screen.shell === "flow" && backHref ? (
            <button
              type="button"
              onClick={() => go(backHref)}
              className="-ml-2 flex min-h-tap items-center gap-1 rounded-control pr-3 pl-1 font-strong text-primary"
            >
              <ChevronLeftIcon className="size-6" aria-hidden />
              Back
            </button>
          ) : null}
          <Link href="/" className="font-heading text-body text-heading no-underline">
            {SHORT_NAME}
          </Link>
          <span className="flex-1" />
          {SANDBOX ? <SandboxPill /> : null}
        </div>
        {step ? (
          <p className="pt-1 text-body" data-testid="step-count">
            Step {step.n} of {step.total}
          </p>
        ) : null}
        <div className="flex flex-col gap-6 pt-3">{children}</div>
      </main>
      {screen.shell === "tabs" ? <TabBar tabs={PARENT_TABS} current={screen.tab} label="Family tabs" /> : null}
      {screen.shell === "owner" ? <TabBar tabs={OWNER_TABS} current={screen.tab} label="Owner tabs" /> : null}
    </>
  );
}

export function PageTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h1 className={cn("font-heading text-big text-heading", className)}>{children}</h1>;
}

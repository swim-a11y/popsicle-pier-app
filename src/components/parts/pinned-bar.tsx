import type { ReactNode } from "react";

/**
 * A cream bar pinned to the bottom of a flow screen, holding its one main
 * button, so the button is on the first screen of a phone. The screen passes
 * `pinned` to its shell so the bar rests at the very bottom at the end.
 */
export function PinnedBar({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-gutter bg-page px-gutter pt-3 pb-3 shadow-bar" data-testid={testId}>
      {children}
    </div>
  );
}

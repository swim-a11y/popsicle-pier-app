"use client";

import { ComingNext } from "@/components/shell/coming-next";
import { ScreenShell } from "@/components/shell/screen-shell";
import { screenById } from "@/screens";

/** Step 1 stand-in, until the screen itself is built. */
export function PlaceholderScreen({ id }: { id: string }) {
  const screen = screenById(id);
  return (
    <ScreenShell id={id}>
      <ComingNext
        title={screen.title}
        purpose="This screen is being built in this version of the sample."
        lines={["see this screen working with the sample families."]}
        preview={<p>{screen.title}</p>}
      />
    </ScreenShell>
  );
}

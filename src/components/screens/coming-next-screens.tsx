"use client";

import { ComingNext } from "@/components/shell/coming-next";
import { ScreenShell } from "@/components/shell/screen-shell";

export function BillsScreen() {
  return (
    <ScreenShell id="bills">
      <ComingNext
        title="Bills"
        purpose="Each month's bill in one place, with the bank draft and card price on every line."
        lines={[
          "see each month's bill by the 19th, at least 10 days before the draft on the 1st.",
          "see when a draft is pending and when the bank has settled it.",
          "change how you pay.",
        ]}
        preview={
          <div className="flex flex-col gap-1">
            <p className="font-strong">December lessons, 4 Sundays at Madison</p>
            <p>Bank draft $136.00</p>
            <p>Card $140.00</p>
          </div>
        }
      />
    </ScreenShell>
  );
}

export function MessagesScreen() {
  return (
    <ScreenShell id="messages">
      <ComingNext
        title="Messages"
        purpose="Notes between your family and the school, kept in one place."
        lines={["read notes from your coach and the front desk.", "tell us about a missed lesson.", "see your past notes."]}
        preview={
          <div className="flex flex-col gap-1">
            <p className="font-strong">From the front desk</p>
            <p>Thanks for letting us know about Sunday. See you the week after.</p>
          </div>
        }
      >
        <p className="rounded-card bg-success px-4 py-3">
          Tell us in a sentence, like &quot;We&apos;ll miss Sunday,&quot; and we&apos;ll take it from there. A person checks every reply.
        </p>
      </ComingNext>
    </ScreenShell>
  );
}

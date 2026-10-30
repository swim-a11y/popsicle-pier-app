"use client";

import { SkeletonRows } from "@/components/parts/skeleton";
import { PageTitle, ScreenShell } from "@/components/shell/screen-shell";
import { Button } from "@/components/ui/button";
import { getStore } from "@/data/app-store";
import { useAppData } from "@/data/use-data";
import { useGo } from "@/lib/nav";
import { emptyDraft, STEP_PATH } from "@/rules/sign-up";
import { SIGN_UP_DRAFT_ID } from "@/sandbox/actions";

export function SignUpStartScreen() {
  const loaded = useAppData();
  const go = useGo();
  const draft = loaded?.data.signUpDrafts.find((d) => d.id === SIGN_UP_DRAFT_ID) ?? null;
  const hasProgress = Boolean(draft && (draft.poolId || draft.children.length > 0 || draft.fullName));

  const startOver = async () => {
    const now = new Date().toISOString();
    await getStore().transaction((tx) => {
      if (tx.get("signUpDrafts", SIGN_UP_DRAFT_ID)) tx.remove("signUpDrafts", SIGN_UP_DRAFT_ID);
      tx.add("signUpDrafts", emptyDraft(SIGN_UP_DRAFT_ID, now));
    });
    go(STEP_PATH.pool);
  };

  return (
    <ScreenShell id="sign-up-start" backHref="/">
      {!loaded ? (
        <SkeletonRows rows={2} />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <PageTitle>Sign up for lessons</PageTitle>
            <p>
              Pick a pool, tell us about your swimmers, choose a time and sign the family release. It takes about two minutes, and nothing is
              charged today.
            </p>
          </div>
          {hasProgress && draft ? (
            <div className="flex flex-col gap-3">
              <Button size="block" onClick={() => go(draft.lastPath)}>
                Pick up where you left off
              </Button>
              <Button variant="secondary" size="block" onClick={startOver}>
                Start over
              </Button>
            </div>
          ) : (
            <Button size="block" onClick={startOver}>
              Start
            </Button>
          )}
          <p className="rounded-card bg-surface px-4 py-3 shadow-card">Already with us? Moving your family over is coming next.</p>
        </>
      )}
    </ScreenShell>
  );
}

"use client";

import { SkeletonRows } from "@/components/parts/skeleton";
import { PageTitle, ScreenShell } from "@/components/shell/screen-shell";
import { Button } from "@/components/ui/button";
import { getStore } from "@/data/app-store";
import { useAppData } from "@/data/use-data";
import { useGo } from "@/lib/nav";
import { setCurrentFamily } from "@/rules/booking";
import { familyChildren, movingFamily } from "@/rules/family";
import { namesList } from "@/rules/release";

export function MoveOverWelcome() {
  const loaded = useAppData();
  const go = useGo();
  if (!loaded) {
    return (
      <ScreenShell id="move-over-welcome">
        <SkeletonRows rows={2} />
      </ScreenShell>
    );
  }
  const family = movingFamily(loaded.data);
  if (!family) {
    return (
      <ScreenShell id="move-over-welcome">
        <PageTitle>Welcome to the new Popsicle Pier app.</PageTitle>
        <p>There&apos;s no family moving over on this phone.</p>
      </ScreenShell>
    );
  }
  const kids = familyChildren(loaded.data, family.id);
  const start = async () => {
    await getStore().transaction((tx) => setCurrentFamily(tx, family.id, "moving"));
    go(family.movedOverAt ? "/" : "/move-over/details");
  };
  return (
    <ScreenShell id="move-over-welcome" backHref="/">
      <PageTitle>Welcome to the new Popsicle Pier app.</PageTitle>
      {family.movedOverAt ? (
        <p>You&apos;re all set. Everything for {namesList(kids.map((k) => k.firstName))} is here.</p>
      ) : (
        <>
          <p>
            Hi {family.parentFullName.split(" ")[0]}. Your details, people and classes for {namesList(kids.map((k) => k.firstName))} are already here. Check each
            one with a tap, confirm your email, link your bank and sign the family release. It takes about a minute.
          </p>
          <p className="rounded-card bg-surface px-4 py-3 shadow-card">Bank details don&apos;t move to the new app, so you&apos;ll link your bank again here.</p>
        </>
      )}
      <Button size="block" onClick={() => void start()}>
        {family.movedOverAt ? "Go to Home" : "Let's start"}
      </Button>
    </ScreenShell>
  );
}

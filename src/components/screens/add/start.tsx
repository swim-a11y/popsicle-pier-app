"use client";

import { ChoiceButton } from "@/components/screens/sign-up/shared";
import { SkeletonRows } from "@/components/parts/skeleton";
import { PageTitle, ScreenShell } from "@/components/shell/screen-shell";
import { Button } from "@/components/ui/button";
import { getStore } from "@/data/app-store";
import { newId } from "@/data/ids";
import { useAppData } from "@/data/use-data";
import { useGo } from "@/lib/nav";
import { ADD_PATH, addDraftId, newAddDraft } from "@/rules/add";
import { currentFamily, familyChildren } from "@/rules/family";
import { currentRelease, familyNeedsToSign } from "@/rules/release";

export function AddStartScreen() {
  const loaded = useAppData();
  const go = useGo();
  if (!loaded) {
    return (
      <ScreenShell id="add-start">
        <SkeletonRows rows={3} />
      </ScreenShell>
    );
  }
  const { data } = loaded;
  const family = currentFamily(data);
  if (!family) {
    return (
      <ScreenShell id="add-start" backHref="/">
        <PageTitle>Add a child or a class</PageTitle>
        <p>Sign up first. Then you can add a brother or sister, or another class.</p>
        <Button size="block" onClick={() => go("/sign-up")}>
          Sign up for lessons
        </Button>
      </ScreenShell>
    );
  }
  if (family.source === "moving-over" && !family.movedOverAt) {
    return (
      <ScreenShell id="add-start" backHref="/">
        <PageTitle>Add a child or a class</PageTitle>
        <p>Finish moving your family over first. Then you can add a brother or sister, or another class.</p>
        <Button size="block" onClick={() => go("/move-over")}>
          Continue moving over
        </Button>
      </ScreenShell>
    );
  }
  const kids = familyChildren(data, family.id);
  const draft = data.addDrafts.find((d) => d.id === addDraftId(family.id));
  const needsSign = familyNeedsToSign(data, family.id);
  const version = currentRelease(data);

  const start = async (mode: "child" | "class", childRecordId: string | null) => {
    const now = new Date().toISOString();
    await getStore().transaction((tx) => {
      const id = addDraftId(family.id);
      if (tx.get("addDrafts", id)) tx.remove("addDrafts", id);
      tx.add("addDrafts", newAddDraft({ familyId: family.id, mode, childRecordId, poolId: family.homePoolId, kidKey: newId(), now }));
    });
    go(mode === "child" ? ADD_PATH.child : ADD_PATH.times);
  };

  return (
    <ScreenShell id="add-start" backHref="/">
      <PageTitle>Add a child or a class</PageTitle>
      {draft ? (
        <Button size="block" onClick={() => go(draft.lastPath)}>
          Pick up where you left off
        </Button>
      ) : null}
      <div className="flex flex-col gap-3">
        <ChoiceButton
          title="A brother or sister"
          line={
            needsSign
              ? `You'll sign the current family release, version ${version.number}, once for everyone.`
              : "Your family release already covers them. You'll answer two questions for them."
          }
          onClick={() => void start("child", null)}
        />
        {kids.map((k) => (
          <ChoiceButton key={k.id} title={`Another class for ${k.firstName}`} line="Pick another time, at either pool." onClick={() => void start("class", k.id)} />
        ))}
      </div>
      <p>Nothing is charged today.</p>
    </ScreenShell>
  );
}

"use client";

import { ReleaseForm } from "@/components/screens/release-form";
import { getStore } from "@/data/app-store";
import { newId } from "@/data/ids";
import { browserName } from "@/lib/browser";
import { AlreadySavedError, firstMissingStep, signAndSave, SignUpIncompleteError, TimeFilledError } from "@/rules/booking";
import { currentRelease } from "@/rules/release";
import { SIGN_BUTTON } from "@/content/release";
import { stepHref } from "@/rules/sign-up";
import { SIGN_UP_DRAFT_ID } from "@/sandbox/actions";

import { NeedsEarlierStep, StepScreen, useSignUpStep } from "./shared";

export function ReleaseStep() {
  const step = useSignUpStep("release");
  if (!step) return <StepScreen step={step} stepKey="release">{null}</StepScreen>;
  const draft = step.draft;
  if (!draft || draft.children.length === 0) {
    return (
      <StepScreen step={step} stepKey="release">
        <NeedsEarlierStep step={step} title="Family release" message="Tell us about your swimmers first. The release names each one." href="/sign-up/swimmers" label="Add your swimmers" />
      </StepScreen>
    );
  }
  const version = currentRelease(step.loaded.data);
  const kids = draft.children.map((c) => ({ key: c.key, firstName: c.firstName }));

  return (
    <StepScreen step={step} stepKey="release">
      <ReleaseForm
        version={version}
        kids={kids}
        release={draft.release}
        signLabel={SIGN_BUTTON}
        onChange={(release) => void step.save((d) => ({ ...d, release }))}
        onSign={async (release) => {
          const missing = firstMissingStep(step.loaded.data, { ...draft, release });
          if (missing && missing.step !== "release") {
            const href = stepHref(missing.step, missing.child);
            return (
              <span className="flex flex-col gap-2">
                <span>{missing.message}</span>
                <button type="button" className="self-start font-strong text-primary underline" onClick={() => step.go(href)}>
                  Go to that step
                </button>
              </span>
            );
          }
          if (missing) return missing.message;
          try {
            await getStore().transaction((tx) => {
              const saved = tx.get("signUpDrafts", SIGN_UP_DRAFT_ID);
              if (!saved) throw new AlreadySavedError();
              return signAndSave(tx, {
                draft: { ...saved, release },
                today: step.loaded.today,
                now: new Date().toISOString(),
                browserName: browserName(navigator.userAgent),
                newId,
              });
            });
            step.go("/sign-up/youre-in", { replace: true });
            return null;
          } catch (e) {
            if (e instanceof AlreadySavedError) {
              step.go("/sign-up/youre-in", { replace: true });
              return null;
            }
            if (e instanceof TimeFilledError || e instanceof SignUpIncompleteError) return e.message;
            throw e;
          }
        }}
      />
    </StepScreen>
  );
}

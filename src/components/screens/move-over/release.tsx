"use client";

import { ReleaseForm } from "@/components/screens/release-form";
import { getStore } from "@/data/app-store";
import { newId } from "@/data/ids";
import { browserName } from "@/lib/browser";
import { AlreadySavedError, finishMovingOver, MOVE_OVER_CHECKS, paymentProblem, releaseProblem, SignUpIncompleteError } from "@/rules/booking";
import { familyChildren } from "@/rules/family";
import { currentRelease } from "@/rules/release";
import { SIGN_BUTTON } from "@/content/release";
import { emptyDraft } from "@/rules/sign-up";

import { MOVE_STEPS, MoveOverScreen, useMoveOver } from "./shared";

export function MoveOverRelease() {
  const step = useMoveOver("release");
  if (step === null || step === "none") return <MoveOverScreen stepKey="release" step={step} title="Family release" />;
  const { family, loaded, draft } = step;
  const kids = familyChildren(loaded.data, family.id).map((c) => ({ key: c.id, firstName: c.firstName }));
  const version = currentRelease(loaded.data);
  const release = draft?.release ?? emptyDraft("x", "").release;

  return (
    <MoveOverScreen stepKey="release" step={step} title="Family release" hideTitle>
      <ReleaseForm
        version={version}
        kids={kids}
        schoolEmail={loaded.data.pools.find((p) => p.id === family.homePoolId)?.schoolEmail ?? ""}
        release={release}
        signLabel={SIGN_BUTTON}
        onChange={(r) => void step.save((d) => ({ ...d, release: r }))}
        onSign={async (r) => {
          const missingCheck = MOVE_OVER_CHECKS.find((c) => !family.movingOverChecks.includes(c));
          if (missingCheck) return `Please check your ${missingCheck} first, on step ${MOVE_STEPS.findIndex((s) => s.key === missingCheck) + 1}.`;
          if (draft?.confirmedEmail !== family.email) return "Please confirm your email with the code first.";
          const pay = paymentProblem(draft.payment, { hasClass: true, hasEval: false }, false);
          if (pay) return pay;
          const rel = releaseProblem(version, r, kids.map((k) => k.key));
          if (rel) return rel;
          try {
            await getStore().transaction((tx) => {
              const saved = tx.get("signUpDrafts", draft.id)!;
              finishMovingOver(tx, { familyId: family.id, draft: { ...saved, release: r }, browserName: browserName(navigator.userAgent), now: new Date().toISOString(), newId });
            });
            step.go("/", { replace: true });
            return null;
          } catch (e) {
            if (e instanceof AlreadySavedError) {
              step.go("/", { replace: true });
              return null;
            }
            if (e instanceof SignUpIncompleteError) return e.message;
            throw e;
          }
        }}
      />
    </MoveOverScreen>
  );
}

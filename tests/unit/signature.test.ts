import { describe, expect, it } from "vitest";

import { BANK_DRAFT_WORDING_VERSION, bankDraftWords } from "@/content/payment";
import { CONSENT_WORDING_VERSION, TEXTS_CONSENT } from "@/content/release";
import { EVALUATION_NEVER_CHARGED, SOMEONE_WILL_TALK } from "@/content/sign-up";
import { LocalStore } from "@/data/store";
import { sha256Hex } from "@/lib/sha256";
import { bookingKinds, paymentProblem, signAndSave } from "@/rules/booking";
import { buildReleaseView, currentRelease, EIGHT_GROUPS, releaseViewText } from "@/rules/release";
import { needsPayment } from "@/rules/sign-up";
import { buildSeed } from "@/sandbox/seed";

import { completeDraft, memoryStorage, NOW, testId, TODAY } from "./helpers";

async function signUp(draft: ReturnType<typeof completeDraft>) {
  const store = new LocalStore({ seedVersion: "t", seed: buildSeed, storage: memoryStorage() });
  await store.transaction((tx) => tx.add("signUpDrafts", draft));
  const { familyId } = await store.transaction((tx) => signAndSave(tx, { draft, today: TODAY, now: NOW, browserName: "Chrome", newId: testId }));
  return { store, familyId, data: await store.snapshot() };
}

describe("signature", () => {
  it("the row holds every field the brief lists", async () => {
    const draft = completeDraft({
      kids: [
        { firstName: "Mia", birth: "2022-07-30", stage: "shallows", booking: { kind: "class", timeId: "mad-sun-1000-shallows" }, research: true },
        { firstName: "Leo", birth: "2023-05-01", stage: "pier", booking: { kind: "class", timeId: "mad-sun-0930-pier" } },
      ],
    });
    const { data, familyId } = await signUp(draft);
    const rows = data.releaseSignatures.filter((s) => s.familyId === familyId);
    expect(rows).toHaveLength(1);
    const s = rows[0];
    expect(s.typedName).toBe("Jordan Sample");
    expect(Object.keys(s.groupsAgreed).sort()).toEqual(EIGHT_GROUPS.map((g) => g.key).sort());
    expect(Object.values(s.groupsAgreed).every(Boolean)).toBe(true);
    expect(s.children.map((c) => c.firstName)).toEqual(["Mia", "Leo"]);
    expect(s.children[0].choices).toEqual({ research: true, marketing: false, underwater: false });
    expect(s.children[0].custodyYes).toBe(false);
    expect(s.children[0].healthYes).toBe(false);
    expect(s.childIds).toEqual(["PP26-0042", "PP26-0043"]);
    expect(s.children.map((c) => c.childId)).toEqual(["PP26-0042", "PP26-0043"]);
    expect(s.versionId).toBe("v2");
    const shown = releaseViewText(buildReleaseView(currentRelease(data), draft.children.map((c) => ({ key: c.key, firstName: c.firstName })), "madison.sample@example.com"));
    expect(s.textSha256).toBe(sha256Hex(shown));
    expect(s.signedAt).toBe(NOW);
    expect(s.signedHow).toBe("online");
    expect(s.confirmedEmail).toBe("jordan.sample@example.com");
    expect(s.browserName).toBe("Chrome");
    expect(s.agreedToSignElectronically).toBe(true);
  });

  it("each consent keeps its exact words and wording version", async () => {
    const { data, familyId } = await signUp(completeDraft({}));
    const s = data.releaseSignatures.find((x) => x.familyId === familyId)!;
    expect(s.consents).toHaveLength(3 + 3);
    const texts = s.consents.find((c) => c.kind === "texts")!;
    expect(texts.words).toBe(TEXTS_CONSENT);
    expect(texts.wordingVersion).toBe(CONSENT_WORDING_VERSION);
    expect(texts.given).toBe(false);
    const research = s.consents.find((c) => c.kind === "research")!;
    expect(research.words).toContain("Yes, Mia can be part of the study.");
    expect(research.wordingVersion).toBe("release-v2");
    // Each consent is its own add-only row too.
    expect(data.consents.filter((c) => c.signatureId === s.id)).toHaveLength(6);
  });

  it("a yes on custody or health flags that child for a person", async () => {
    const { data, familyId } = await signUp(
      completeDraft({
        poolId: "pool-buckhead",
        kids: [
          { firstName: "Leo", birth: "2023-05-01", stage: "pier", booking: { kind: "class", timeId: "buc-sun-0930-pier" } },
          { firstName: "Ada", birth: "2020-06-01", stage: "cove", booking: { kind: "class", timeId: "buc-sun-1000-cove" }, custodyYes: true },
        ],
      }),
    );
    const kids = data.children.filter((c) => c.familyId === familyId);
    expect(kids.find((c) => c.firstName === "Ada")!.flaggedForPerson).toBe(true);
    expect(kids.find((c) => c.firstName === "Leo")!.flaggedForPerson).toBe(false);
    expect(data.releaseSignatures.find((s) => s.familyId === familyId)!.children.find((c) => c.firstName === "Ada")!.custodyYes).toBe(true);
    expect(SOMEONE_WILL_TALK).toBe("Thanks. Someone from the school will talk with you before the first lesson.");
  });
});

describe("bank draft", () => {
  it("the authorization row holds family, reference, exact words, version, email and time", async () => {
    const { data, familyId } = await signUp(completeDraft({ payment: "bank" }));
    const rows = data.bankDraftAuthorizations.filter((a) => a.familyId === familyId);
    expect(rows).toHaveLength(1);
    const a = rows[0];
    expect(a.processorRef).toBe("SANDBOX-REF-0001");
    expect(a.words).toBe(bankDraftWords("madison.sample@example.com"));
    expect(a.words).toContain("You can cancel these drafts anytime by emailing us at madison.sample@example.com.");
    expect(a.words).toContain("SAMPLE authorization");
    expect(a.words).toContain("I authorize these bank drafts");
    expect(a.wordingVersion).toBe(BANK_DRAFT_WORDING_VERSION);
    expect(a.confirmedEmail).toBe("jordan.sample@example.com");
    expect(a.authorizedAt).toBe(NOW);
    const methods = data.paymentMethods.filter((p) => p.familyId === familyId);
    expect(methods.map((m) => [m.kind, m.job, m.processorRef])).toEqual([
      ["bank", "main", "SANDBOX-REF-0001"],
      ["card", "backup", "SANDBOX-REF-0002"],
    ]);
  });
});

describe("payment", () => {
  it("references only, never a card or bank number", async () => {
    const { data, familyId } = await signUp(completeDraft({ payment: "card" }));
    for (const m of data.paymentMethods.filter((p) => p.familyId === familyId)) {
      expect(Object.keys(m).sort()).toEqual(["addedAt", "familyId", "id", "job", "kind", "processorRef"]);
      expect(m.processorRef).toMatch(/^SANDBOX-REF-\d{4}$/);
    }
    const json = JSON.stringify(data);
    expect(json).not.toMatch(/last4|lastFour|routing|accountNumber|cardNumber/i);
    expect(json).not.toMatch(/\b\d{9,19}\b/);
    expect(data.bankDraftAuthorizations.filter((a) => a.familyId === familyId)).toHaveLength(0);
  });

  it("free evaluation only is never charged and asks for a card to hold the spot", async () => {
    const draft = completeDraft({
      kids: [{ firstName: "Ivy", birth: "2024-03-01", stage: "evaluation", booking: { kind: "evaluation", timeId: "mad-eval-sun-1100" } }],
      payment: "hold",
    });
    expect(needsPayment(draft, true)).toBe(true);
    expect(needsPayment(draft, false)).toBe(false);
    expect(paymentProblem({ ...draft.payment, holdCard: false }, bookingKinds(draft), true)).toMatch(/hold the spot/);
    const { data, familyId } = await signUp(draft);
    const enrollment = data.enrollments.find((e) => e.familyId === familyId)!;
    expect(enrollment.kind).toBe("evaluation");
    expect(enrollment.lessonTypeId).toBeNull();
    expect(data.paymentMethods.filter((p) => p.familyId === familyId).map((m) => [m.kind, m.job])).toEqual([["card", "main"]]);
    expect(data.bankDraftAuthorizations.filter((a) => a.familyId === familyId)).toHaveLength(0);
    expect(EVALUATION_NEVER_CHARGED).toBe("The free evaluation is never charged.");
  });
});

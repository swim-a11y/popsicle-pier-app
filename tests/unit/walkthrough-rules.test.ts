import { describe, expect, it } from "vitest";

import { EMAIL_US_FIRST, EVALUATION_NEVER_CHARGED, isParentOrGuardian } from "@/content/sign-up";
import { LocalStore } from "@/data/store";
import { AlreadySavedError, bookingKinds, finishMovingOver, moveOverDraftId, paymentProblem, signAndSave } from "@/rules/booking";
import { AdultCantStayError, approvedNotesForFamily, markLessonHeld } from "@/rules/first-sunday";
import { familyChildren, familyLessons, familyPayment, howTheyPay, priceTheyPay } from "@/rules/family";
import { EIGHT_GROUPS, familyNeedsToSign, latestSignature } from "@/rules/release";
import { emptyDraft, needsPayment, signUpSteps } from "@/rules/sign-up";
import { timesForChild } from "@/rules/times";
import { pretendFirstLesson } from "@/sandbox/pretend-first-lesson";
import { buildSeed, MOVING_FAMILY_ID } from "@/sandbox/seed";
import { SAMPLE_CODE } from "@/sandbox/sample-code";

import { completeDraft, memoryStorage, NOW, testId, TODAY } from "./helpers";

const newStore = () => new LocalStore({ seedVersion: "t", seed: buildSeed, storage: memoryStorage() });
async function signUp(store: LocalStore, draft: ReturnType<typeof completeDraft>) {
  await store.transaction((tx) => tx.add("signUpDrafts", draft));
  return store.transaction((tx) => signAndSave(tx, { draft, today: TODAY, now: NOW, browserName: "Chrome", newId: testId }));
}

describe("walk-through rules", () => {
  it("walk-through 1: one child at Madison books once with the bank-draft price", async () => {
    const store = newStore();
    const draft = completeDraft({});
    const spots = (await store.get("classes", "mad-sun-1000-shallows"))!.openSpots;
    const { familyId } = await signUp(store, draft);
    const data = await store.snapshot();
    const [lesson] = familyLessons(data, familyId);
    expect(lesson.firstLessonDate).toBe("2026-11-01");
    expect(lesson.startTime).toBe("10:00");
    expect(lesson.pool.name).toBe("Madison");
    expect(lesson.instructorFirstName).toBe("Dev");
    expect(priceTheyPay(lesson, familyPayment(data, familyId).main)).toBe("$34.00 a lesson by bank draft");
    expect(data.classes.find((c) => c.id === "mad-sun-1000-shallows")!.openSpots).toBe(spots - 1);
    expect(data.releaseSignatures.filter((s) => s.familyId === familyId)).toHaveLength(1);
    expect(data.bankDraftAuthorizations.filter((a) => a.familyId === familyId)).toHaveLength(1);
    await expect(store.transaction((tx) => signAndSave(tx, { draft, today: TODAY, now: NOW, browserName: "Chrome", newId: testId }))).rejects.toThrow(AlreadySavedError);
  });

  it("walk-through 2: two children at Buckhead with a grandmother listed", async () => {
    const data = buildSeed();
    const six = timesForChild({ data, poolId: "pool-buckhead", birthDate: "2020-06-01", stage: "cove", today: TODAY, siblings: [{ name: "Leo", booking: { kind: "class", timeId: "buc-sun-0930-pier" } }] });
    expect(six.classes[0].full).toBe(true);
    const ten = six.classes.find((c) => c.id === "buc-sun-1000-cove")!;
    expect(ten.sibling).toEqual({ name: "Leo", relation: "next-to" });
    for (const o of [...six.classes, ...six.evaluations]) expect(o.firstLessonDate >= "2026-11-08").toBe(true);
    expect(isParentOrGuardian("grandparent")).toBe(false);
    expect(EMAIL_US_FIRST).toBe("For now, if the only adult staying would be someone other than a parent or guardian, email us before the lesson so we can confirm it.");

    const store = newStore();
    const draft = completeDraft({
      poolId: "pool-buckhead",
      listed: [{ firstName: "Rose", relationship: "grandparent" }],
      kids: [
        { firstName: "Leo", birth: "2023-05-01", stage: "pier", booking: { kind: "class", timeId: "buc-sun-0930-pier" } },
        { firstName: "Ada", birth: "2020-06-01", stage: "cove", booking: { kind: "class", timeId: "buc-sun-1000-cove" }, waitlist: ["buc-sun-0900-cove"], custodyYes: true },
      ],
    });
    // Close the tab mid-flow and come back: the draft and its step are still there.
    await store.transaction((tx) => tx.add("signUpDrafts", { ...draft, lastPath: "/sign-up/people" }));
    const reopened = new LocalStore({ seedVersion: "t", seed: buildSeed, storage: (store as unknown as { options: { storage: ReturnType<typeof memoryStorage> } }).options.storage });
    expect((await reopened.get("signUpDrafts", draft.id))!.lastPath).toBe("/sign-up/people");
    const { familyId } = await reopened.transaction((tx) => signAndSave(tx, { draft, today: TODAY, now: NOW, browserName: "Chrome", newId: testId }));
    const after = await reopened.snapshot();
    const rose = after.listedAdults.find((a) => a.familyId === familyId)!;
    expect(rose.status).toBe("waiting");
    expect(rose.isParentOrGuardian).toBe(false);
    const kids = familyChildren(after, familyId);
    expect(kids.find((k) => k.firstName === "Ada")!.flaggedForPerson).toBe(true);
    expect(kids.find((k) => k.firstName === "Leo")!.flaggedForPerson).toBe(false);
    const signatures = after.releaseSignatures.filter((s) => s.familyId === familyId);
    expect(signatures).toHaveLength(1);
    expect(signatures[0].children.map((c) => c.firstName)).toEqual(["Leo", "Ada"]);
    expect(after.waitlistEntries.filter((w) => w.familyId === familyId).map((w) => w.classId)).toEqual(["buc-sun-0900-cove"]);
    for (const l of familyLessons(after, familyId)) expect(l.firstLessonDate >= "2026-11-08").toBe(true);
  });

  it("walk-through 3: two-year-olds", async () => {
    const data = buildSeed();
    const birth = "2024-06-15";
    const buckhead = timesForChild({ data, poolId: "pool-buckhead", birthDate: birth, stage: "pier", today: TODAY });
    expect(buckhead.tooYoung?.canStartOn).toBe("2026-12-15");
    const madison = timesForChild({ data, poolId: "pool-madison", birthDate: birth, stage: "pier", today: TODAY });
    expect(madison.under3).toBe(true);
    expect(madison.classes.length).toBeGreaterThan(0);
    for (const c of madison.classes) {
      expect(c.lessonKind).toBe("private");
      expect(c.parentInWater).toBe(true);
    }
    expect(madison.evaluations.length).toBeGreaterThan(0);
    const draft = completeDraft({ kids: [{ firstName: "Ivy", birth, stage: "pier", booking: { kind: "evaluation", timeId: "mad-eval-sun-1100" } }], payment: "hold" });
    expect(needsPayment(draft, true)).toBe(true);
    expect(paymentProblem({ ...draft.payment, holdCard: false }, bookingKinds(draft), true)).toBe("Please add a card to hold the spot.");
    expect(EVALUATION_NEVER_CHARGED).toBe("The free evaluation is never charged.");
    const store = newStore();
    const { familyId } = await signUp(store, draft);
    const after = await store.snapshot();
    expect(familyLessons(after, familyId)[0].bankCents).toBeNull();
    expect(howTheyPay(after, familyId)).toMatch(/never charged/);
  });

  it("walk-through 4: the family moving over signs once for both children", async () => {
    const store = newStore();
    const before = await store.snapshot();
    expect(familyNeedsToSign(before, MOVING_FAMILY_ID)).toBe(true);
    const draftId = moveOverDraftId(MOVING_FAMILY_ID);
    const kids = familyChildren(before, MOVING_FAMILY_ID);
    const draft = {
      ...emptyDraft(draftId, NOW),
      email: "dana.whitcombe@example.com",
      code: SAMPLE_CODE,
      codeSent: true,
      confirmedEmail: "dana.whitcombe@example.com",
      payment: { main: "bank" as const, authorized: true, backupCard: true, holdCard: false },
      release: {
        groups: Object.fromEntries(EIGHT_GROUPS.map((g) => [g.key, true])),
        perChild: Object.fromEntries(kids.map((k) => [k.id, { custody: "no" as const, health: "no" as const, research: false, marketing: false, underwater: false }])),
        texts: false,
        newsletter: false,
        marketingEmails: false,
        typedName: "Dana Whitcombe",
        agreeElectronic: true,
      },
    };
    await store.transaction((tx) => {
      tx.add("signUpDrafts", draft);
      tx.update("families", MOVING_FAMILY_ID, { movingOverChecks: ["details", "people", "classes"] });
    });
    await store.transaction((tx) => finishMovingOver(tx, { familyId: MOVING_FAMILY_ID, draft, browserName: "Safari", now: NOW, newId: testId }));
    const after = await store.snapshot();
    const s = latestSignature(after, MOVING_FAMILY_ID)!;
    expect(s.versionId).toBe("v2");
    expect(s.children.map((c) => c.firstName)).toEqual(["Juniper", "Theo"]);
    expect(s.childIds).toEqual(["PP25-0031", "PP24-0017"]);
    expect(after.releaseSignatures.filter((x) => x.familyId === MOVING_FAMILY_ID)).toHaveLength(1);
    expect(after.bankDraftAuthorizations.filter((a) => a.familyId === MOVING_FAMILY_ID)).toHaveLength(1);
    expect(howTheyPay(after, MOVING_FAMILY_ID)).toBe("Bank draft, with a backup card");
    expect(familyLessons(after, MOVING_FAMILY_ID).map((l) => l.child.firstName).sort()).toEqual(["Juniper", "Theo"]);
    expect(after.families.find((f) => f.id === MOVING_FAMILY_ID)!.movedOverAt).toBe(NOW);
    // Nothing the school already had was retyped: same children, contacts and classes.
    expect(familyChildren(after, MOVING_FAMILY_ID)).toEqual(kids);
    expect(after.emergencyContacts.filter((c) => c.familyId === MOVING_FAMILY_ID)).toEqual(before.emergencyContacts.filter((c) => c.familyId === MOVING_FAMILY_ID));
  });

  it("walk-through 5: cold run paying by card", async () => {
    const store = newStore();
    const draft = completeDraft({ payment: "card", kids: [{ firstName: "Ada", birth: "2021-08-30", stage: "pier", booking: { kind: "class", timeId: "mad-sun-0930-pier" } }] });
    expect(signUpSteps(draft, true)).toHaveLength(9);
    const { familyId } = await signUp(store, draft);
    const data = await store.snapshot();
    const { main } = familyPayment(data, familyId);
    expect(main?.kind).toBe("card");
    expect(priceTheyPay(familyLessons(data, familyId)[0], main)).toBe("$35.00 a lesson by card");
    expect(data.bankDraftAuthorizations.filter((a) => a.familyId === familyId)).toHaveLength(0);
  });

  it("walk-through 6: the first Sunday names the parent on deck, never a Waiting adult", async () => {
    const store = newStore();
    const one = await signUp(store, completeDraft({}));
    const two = await signUp(
      store,
      completeDraft({
        poolId: "pool-buckhead",
        listed: [{ firstName: "Rose", relationship: "grandparent" }],
        kids: [{ firstName: "Leo", birth: "2023-05-01", stage: "pier", booking: { kind: "class", timeId: "buc-sun-0930-pier" } }],
      }),
    );
    expect((await store.transaction((tx) => pretendFirstLesson(tx, { familyId: one.familyId, now: NOW, newId: testId }))).added).toBe(1);
    expect((await store.transaction((tx) => pretendFirstLesson(tx, { familyId: one.familyId, now: NOW, newId: testId }))).added).toBe(0);
    const data = await store.snapshot();
    const [note] = approvedNotesForFamily(data, one.familyId);
    expect(note.status).toBe("approved");
    expect(note.approvedBy).toBe("Dev");
    // Walk-through 2's family: the Waiting grandmother can't be the adult on deck.
    const enrollment = data.enrollments.find((e) => e.familyId === two.familyId)!;
    const rose = data.listedAdults.find((a) => a.familyId === two.familyId)!;
    await expect(
      store.transaction((tx) =>
        markLessonHeld(tx, { enrollmentId: enrollment.id, adult: { kind: "listed-adult", listedAdultId: rose.id, firstName: "Rose", isParentOrGuardian: false }, now: NOW, id: "m" }),
      ),
    ).rejects.toThrow(AdultCantStayError);
    await store.transaction((tx) => pretendFirstLesson(tx, { familyId: two.familyId, now: NOW, newId: testId }));
    const marks = (await store.snapshot()).attendanceMarks.filter((m) => m.familyId === two.familyId);
    expect(marks).toHaveLength(1);
    expect(marks[0].adult.kind).toBe("parent");
  });
});

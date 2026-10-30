import { describe, expect, it } from "vitest";

import { LocalStore } from "@/data/store";
import type { AddDraft } from "@/data/types";
import { addDraftId, addProblem, addSteps, addTimes, commitAdd, latestAddition, newAddDraft } from "@/rules/add";
import { AlreadySavedError, signAndSave } from "@/rules/booking";
import { familyLessons, nextLessonPerChild, poolsWithFirstVisitAhead } from "@/rules/family";
import { EIGHT_GROUPS, latestSignature } from "@/rules/release";
import { buildSeed } from "@/sandbox/seed";

import { completeDraft, memoryStorage, NOW, testId, TODAY } from "./helpers";

const LATER = "2026-10-30T16:00:00.000Z";

async function familyWithMia() {
  const store = new LocalStore({ seedVersion: "t", seed: buildSeed, storage: memoryStorage() });
  const draft = completeDraft({});
  await store.transaction((tx) => tx.add("signUpDrafts", draft));
  const { familyId } = await store.transaction((tx) => signAndSave(tx, { draft, today: TODAY, now: NOW, browserName: "Chrome", newId: testId }));
  return { store, familyId };
}

function brother(familyId: string, patch: Partial<AddDraft> = {}): AddDraft {
  const d = newAddDraft({ familyId, mode: "child", childRecordId: null, poolId: "pool-madison", kidKey: "new-kid", now: LATER });
  return {
    ...d,
    kid: { ...d.kid, firstName: "Jules", birthMonth: "6", birthDay: "15", birthYear: "2023", stage: "pier", booking: { kind: "class", timeId: "mad-sun-0930-pier" } },
    answers: { custody: "no", health: "yes", research: true, marketing: false, underwater: false },
    ...patch,
  };
}

async function add(store: LocalStore, draft: AddDraft) {
  await store.transaction((tx) => tx.add("addDrafts", draft));
  return store.transaction((tx) => commitAdd(tx, { draftId: draft.id, today: TODAY, now: LATER, newId: testId, browserName: "Chrome" }));
}

describe("adding a child or a class", () => {
  it("a brother or sister signs nothing: a coverage row with their own answers", async () => {
    const { store, familyId } = await familyWithMia();
    const before = await store.snapshot();
    const signature = latestSignature(before, familyId)!;
    expect(addSteps({ mode: "child" })).toEqual(["child", "stage", "times", "questions", "review"]);
    const { childRecordId } = await add(store, brother(familyId));
    const after = await store.snapshot();
    // Nothing new to sign, and the signature itself is never edited.
    expect(after.releaseSignatures.filter((s) => s.familyId === familyId)).toEqual([signature]);
    const coverage = after.coverages.filter((c) => c.familyId === familyId);
    expect(coverage).toHaveLength(1);
    expect(coverage[0]).toMatchObject({ signatureId: signature.id, versionId: "v2", childRecordId, answers: { custodyYes: false, healthYes: true, choices: { research: true, marketing: false, underwater: false } } });
    // Each choice is its own consent row with its exact words.
    const consents = after.consents.filter((c) => c.childRecordId === childRecordId);
    expect(consents.map((c) => [c.kind, c.given])).toEqual([
      ["research", true],
      ["marketing", false],
      ["underwater", false],
    ]);
    expect(consents[0].words).toContain("Yes, Jules can be part of the study.");
    // A yes goes to a person.
    const jules = after.children.find((c) => c.id === childRecordId)!;
    expect(jules.flaggedForPerson).toBe(true);
    // Booked like any child: an ID on the first booking, one spot taken, next to Mia's lesson.
    expect(jules.childId).toBe("PP26-0043");
    expect(after.classes.find((c) => c.id === "mad-sun-0930-pier")!.openSpots).toBe(1);
    expect(familyLessons(after, familyId).map((l) => l.child.firstName).sort()).toEqual(["Jules", "Mia"]);
    expect(latestAddition(after, familyId)?.child.firstName).toBe("Jules");
    expect(after.addDrafts).toHaveLength(0);
  });

  it("marks times next to a brother's or sister's lesson", async () => {
    const { store, familyId } = await familyWithMia();
    const t = addTimes(await store.snapshot(), brother(familyId), TODAY)!;
    expect(t.classes.find((c) => c.id === "mad-sun-0930-pier")!.sibling).toEqual({ name: "Mia", relation: "next-to" });
  });

  it("another class at the other pool keeps one ID", async () => {
    const { store, familyId } = await familyWithMia();
    const data = await store.snapshot();
    const mia = data.children.find((c) => c.familyId === familyId)!;
    const draft: AddDraft = {
      ...newAddDraft({ familyId, mode: "class", childRecordId: mia.id, poolId: "pool-buckhead", kidKey: "k", now: LATER }),
    };
    expect(addSteps(draft)).toEqual(["times", "review"]);
    const t = addTimes(data, draft, TODAY)!;
    expect(t.classes.map((c) => c.id)).toEqual(["buc-wed-1600-shallows"]);
    const counter = data.counters.find((c) => c.id === "child-serial")!.next;
    await add(store, { ...draft, kid: { ...draft.kid, booking: { kind: "class", timeId: "buc-wed-1600-shallows" } } });
    const after = await store.snapshot();
    expect(after.children.find((c) => c.id === mia.id)!.childId).toBe("PP26-0042");
    expect(after.counters.find((c) => c.id === "child-serial")!.next).toBe(counter);
    const lessons = familyLessons(after, familyId).filter((l) => l.child.id === mia.id);
    expect(lessons.map((l) => l.pool.name).sort()).toEqual(["Buckhead", "Madison"]);
    expect(lessons.find((l) => l.pool.name === "Buckhead")!.firstLessonDate >= "2026-11-08").toBe(true);
    // A class adds no coverage and no signature.
    expect(after.coverages).toHaveLength(0);
    expect(after.releaseSignatures.filter((s) => s.familyId === familyId)).toHaveLength(1);
  });

  it("another class never offers the child's own class or a time that runs into theirs", async () => {
    const { store, familyId } = await familyWithMia();
    const data = await store.snapshot();
    const mia = data.children.find((c) => c.familyId === familyId)!;
    const draft = newAddDraft({ familyId, mode: "class", childRecordId: mia.id, poolId: "pool-madison", kidKey: "k", now: LATER });
    const t = addTimes(data, draft, TODAY)!;
    expect(t.classes.map((c) => c.id)).not.toContain("mad-sun-1000-shallows");
    // Mia has a stage, so no free evaluation is offered for another class.
    expect(t.evaluations).toHaveLength(0);
    expect(addProblem(data, { ...draft, kid: { ...draft.kid, booking: { kind: "class", timeId: "mad-sun-1000-shallows" } } }, TODAY)).toMatchObject({ step: "times" });
  });

  it("checks every answer before adding, and adds once", async () => {
    const { store, familyId } = await familyWithMia();
    const data = await store.snapshot();
    expect(addProblem(data, brother(familyId, { kid: { ...brother(familyId).kid, firstName: " " } }), TODAY)).toMatchObject({ step: "child" });
    expect(addProblem(data, brother(familyId, { kid: { ...brother(familyId).kid, stage: null } }), TODAY)).toMatchObject({ step: "stage" });
    expect(addProblem(data, brother(familyId, { kid: { ...brother(familyId).kid, booking: null } }), TODAY)).toMatchObject({ step: "times" });
    expect(addProblem(data, brother(familyId, { answers: { custody: null, health: "no", research: false, marketing: false, underwater: false } }), TODAY)).toMatchObject({ step: "questions" });
    const draft = brother(familyId);
    await add(store, draft);
    const families = (await store.snapshot()).children.length;
    await expect(store.transaction((tx) => commitAdd(tx, { draftId: draft.id, today: TODAY, now: LATER, newId: testId, browserName: "Chrome" }))).rejects.toThrow(AlreadySavedError);
    expect((await store.snapshot()).children.length).toBe(families);
    expect(addDraftId(familyId)).toBe(draft.id);
  });

  it("a brother joining his sister's class sees her spot counted once", async () => {
    const { store, familyId } = await familyWithMia();
    // Mia holds one of the two spots in Sundays at 10:00.
    const draft = brother(familyId, { kid: { ...brother(familyId).kid, birthYear: "2022", stage: "shallows", booking: null } });
    const ten = addTimes(await store.snapshot(), draft, TODAY)!.classes.find((c) => c.id === "mad-sun-1000-shallows")!;
    expect(ten.full).toBe(false);
    expect(ten.spotsLeft).toBe(1);
    expect(ten.sibling).toEqual({ name: "Mia", relation: "same-time" });
    expect(ten.noPartnerYet).toBe(false);
  });

  it("marks a sibling's lesson only at the same pool", async () => {
    const { store, familyId } = await familyWithMia();
    // Sundays at 10:00 at Buckhead isn't next to Mia's Sunday 10:00 at Madison.
    const draft = brother(familyId, { poolId: "pool-buckhead", kid: { ...brother(familyId).kid, birthYear: "2020", stage: "cove", booking: null } });
    const t = addTimes(await store.snapshot(), draft, TODAY)!;
    expect(t.classes.find((c) => c.id === "buc-sun-1000-cove")!.sibling).toBeNull();
  });

  it("an under-3 brother sees only private times with a parent in the water", async () => {
    const { store, familyId } = await familyWithMia();
    const draft = brother(familyId, { kid: { ...brother(familyId).kid, birthMonth: "6", birthDay: "1", birthYear: "2024", stage: "pier", booking: null } });
    const t = addTimes(await store.snapshot(), draft, TODAY)!;
    expect(t.under3).toBe(true);
    expect(t.classes.map((c) => c.id)).toEqual(["mad-sun-0900-water"]);
    for (const c of t.classes) expect(c.parentInWater).toBe(true);
  });

  it("a family whose only booking is a free evaluation sets up lesson payment with a person first", async () => {
    const store = new LocalStore({ seedVersion: "t", seed: buildSeed, storage: memoryStorage() });
    const signUp = completeDraft({ kids: [{ firstName: "Ivy", birth: "2022-01-01", stage: "evaluation", booking: { kind: "evaluation", timeId: "mad-eval-sun-1100" } }], payment: "hold" });
    await store.transaction((tx) => tx.add("signUpDrafts", signUp));
    const { familyId } = await store.transaction((tx) => signAndSave(tx, { draft: signUp, today: TODAY, now: NOW, browserName: "Chrome", newId: testId }));
    const data = await store.snapshot();
    // A class: no bank draft or card chosen for lessons yet, so a person sets it up.
    expect(addProblem(data, brother(familyId), TODAY)).toMatchObject({ step: "times", message: expect.stringContaining("a person sets up how you'll pay for lessons first") });
    // A free evaluation for the brother still works with the card that holds the spot.
    const evaluation = brother(familyId, { kid: { ...brother(familyId).kid, stage: "evaluation", booking: { kind: "evaluation", timeId: "mad-eval-sun-1130" } } });
    expect(addProblem(data, evaluation, TODAY)).toBeNull();
  });

  it("a child's next lesson can come from any of their classes", async () => {
    const { store, familyId } = await familyWithMia();
    const mia = (await store.snapshot()).children.find((c) => c.familyId === familyId)!;
    const draft = newAddDraft({ familyId, mode: "class", childRecordId: mia.id, poolId: "pool-buckhead", kidKey: "k", now: LATER });
    await add(store, { ...draft, kid: { ...draft.kid, booking: { kind: "class", timeId: "buc-wed-1600-shallows" } } });
    const data = await store.snapshot();
    expect(nextLessonPerChild(data, familyId, TODAY)[0].pool.name).toBe("Madison");
    // The Monday after November 8: Wednesday at Buckhead (November 11) comes before the next Sunday (November 15).
    const later = nextLessonPerChild(data, familyId, "2026-11-09")[0];
    expect(later.pool.name).toBe("Buckhead");
    expect(later.date).toBe("2026-11-11");
    expect(poolsWithFirstVisitAhead(data, familyId).map((p) => p.name).sort()).toEqual(["Buckhead", "Madison"]);
  });

  it("a family on an older release signs the current one once for everyone", async () => {
    const store = new LocalStore({ seedVersion: "t", seed: buildSeed, storage: memoryStorage() });
    const familyId = "family-marlow";
    const draft = brother(familyId, {
      kid: { ...brother(familyId).kid, booking: null, waitlistClassIds: ["mad-wed-1630-shallows"] },
    });
    const data = await store.snapshot();
    expect(addProblem(data, draft, TODAY)).toMatchObject({ step: "questions" });
    const kids = data.children.filter((c) => c.familyId === familyId).map((c) => c.id);
    const release = {
      groups: Object.fromEntries(EIGHT_GROUPS.map((g) => [g.key, true])),
      perChild: Object.fromEntries([...kids, "new-kid"].map((k) => [k, { custody: "no" as const, health: "no" as const, research: false, marketing: false, underwater: false }])),
      texts: false,
      newsletter: false,
      marketingEmails: false,
      typedName: "Lee Marlow",
      agreeElectronic: true,
    };
    await add(store, { ...draft, release });
    const after = await store.snapshot();
    const latest = latestSignature(after, familyId)!;
    expect(latest.versionId).toBe("v2");
    expect(latest.children.map((c) => c.firstName)).toEqual(["Ari", "Jules"]);
    expect(after.coverages).toHaveLength(0);
    // The older signature is still there, untouched.
    expect(after.releaseSignatures.filter((s) => s.familyId === familyId)).toHaveLength(2);
  });

  it("another class that only joins a waitlist reads as the waitlist, not an earlier addition", async () => {
    const { store, familyId } = await familyWithMia();
    const mia = (await store.snapshot()).children.find((c) => c.familyId === familyId)!;
    // First another class, then a waitlist for a full one.
    const draft = newAddDraft({ familyId, mode: "class", childRecordId: mia.id, poolId: "pool-buckhead", kidKey: "k", now: LATER });
    await add(store, { ...draft, kid: { ...draft.kid, booking: { kind: "class", timeId: "buc-wed-1600-shallows" } } });
    const wait = newAddDraft({ familyId, mode: "class", childRecordId: mia.id, poolId: "pool-madison", kidKey: "k2", now: "2026-10-30T17:00:00.000Z" });
    await store.transaction((tx) => tx.add("addDrafts", { ...wait, kid: { ...wait.kid, waitlistClassIds: ["mad-wed-1630-shallows"] } }));
    await store.transaction((tx) => commitAdd(tx, { draftId: wait.id, today: TODAY, now: "2026-10-30T17:00:00.000Z", newId: testId, browserName: "Chrome" }));
    const latest = latestAddition(await store.snapshot(), familyId)!;
    expect([latest.child.firstName, latest.enrollment, latest.waitlistOnly]).toEqual(["Mia", null, true]);
  });
});

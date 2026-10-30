import { describe, expect, it } from "vitest";

import { LocalStore } from "@/data/store";
import type { SignUpDraft } from "@/data/types";
import { bookTime, signAndSave } from "@/rules/booking";
import { monthBill } from "@/rules/bills";
import { familyLessons, lessonDaysAhead, nextLessonPerChild, replacementLessons } from "@/rules/family";
import { answerFillIn, fillInState, sendFillIn } from "@/rules/fillins";
import { missOptions, sendNote } from "@/rules/notes";
import { leaveClass, OfferProblemError } from "@/rules/offers";
import { cancelClassDate, owedState } from "@/rules/owed";
import { timesForChild } from "@/rules/times";
import { buildSeed } from "@/sandbox/seed";
import { pretendFirstLesson } from "@/sandbox/pretend-first-lesson";

import { completeDraft, memoryStorage, NOW, testId, TODAY } from "./helpers";

async function family(draft: SignUpDraft = completeDraft({}), edit?: (store: LocalStore) => Promise<void>) {
  const store = new LocalStore({ seedVersion: "t", seed: buildSeed, storage: memoryStorage() });
  if (edit) await edit(store);
  await store.transaction((tx) => tx.add("signUpDrafts", draft));
  const { familyId } = await store.transaction((tx) => signAndSave(tx, { draft, today: TODAY, now: NOW, browserName: "Chrome", newId: testId }));
  const child = (await store.snapshot()).children.find((c) => c.familyId === familyId)!;
  return { store, familyId, child };
}

async function miss(store: LocalStore, familyId: string, childRecordId: string, date: string) {
  const option = missOptions(await store.snapshot(), familyId, childRecordId, TODAY).find((o) => o.date === date)!;
  return store.transaction((tx) => sendNote(tx, { familyId, childRecordId, kind: "miss", enrollmentId: option.enrollmentId, lessonDate: date, today: TODAY, now: NOW, newId: testId }));
}

/** Coach Dev's Sunday 9:30 class becomes a one-place Shallows class, so Mia can be offered a class slot. */
const devShallows = async (store: LocalStore) => {
  await store.transaction((tx) => tx.update("classes", "mad-sun-0930-pier", { stageId: "shallows", openSpots: 1, capacity: 1 }));
};

describe("fill-ins and the dates around them", () => {
  it("a lesson marked after a missed first day isn't listed as coming, or offered to miss", async () => {
    const { store, familyId, child } = await family();
    await miss(store, familyId, child.id, "2026-11-01");
    await store.transaction((tx) => pretendFirstLesson(tx, { familyId, now: NOW, newId: testId }));
    const data = await store.snapshot();
    expect(data.attendanceMarks.find((m) => m.familyId === familyId)!.lessonDate).toBe("2026-11-08");
    const days = lessonDaysAhead(data, familyLessons(data, familyId)[0], TODAY, 6).map((d) => d.date);
    expect(days).toContain("2026-11-01");
    expect(days).not.toContain("2026-11-08");
    expect(days).toHaveLength(6);
    expect(missOptions(data, familyId, child.id, TODAY).map((o) => o.date)).not.toContain("2026-11-08");
  });

  it("a class slot can be a fill-in, and a new weekly booking there starts after the day it fills", async () => {
    const { store, familyId, child } = await family(completeDraft({}), devShallows);
    const note = await miss(store, familyId, child.id, "2026-11-08");
    const state = fillInState(await store.snapshot(), note, TODAY);
    if (state?.kind !== "offer") throw new Error(String(state?.kind));
    expect(state.slots.map((s) => `${s.kind} ${s.date} ${s.time.startTime}`)).toContain("class 2026-11-15 09:30");
    const fillIn = await store.transaction((tx) => sendFillIn(tx, { noteId: note.id, timeId: "mad-sun-0930-pier", date: "2026-11-15", today: TODAY, now: NOW, newId: testId }));
    await store.transaction((tx) => answerFillIn(tx, { fillInId: fillIn.id, familyId, answer: "yes", today: TODAY, now: NOW }));
    const data = await store.snapshot();
    // The one place on November 15 is Mia's, so a new weekly swimmer starts the week after.
    const other = timesForChild({ data, poolId: "pool-madison", birthDate: "2021-01-01", stage: "shallows", today: TODAY }).classes.find((c) => c.id === "mad-sun-0930-pier")!;
    expect(other.firstLessonDate).toBe("2026-11-22");
    const booked = await store.transaction((tx) =>
      bookTime(tx, { familyId: "family-marlow", childRecordId: "child-ari", booking: { kind: "class", timeId: "mad-sun-0930-pier" }, poolId: "pool-madison", today: TODAY, now: NOW, newId: testId, alone: true }),
    );
    expect(booked.firstLessonDate).toBe("2026-11-22");
  });

  it("never a slot that runs into the child's own one-off that day", async () => {
    const { store, familyId, child } = await family(
      completeDraft({}),
      async (s) => void (await s.transaction((tx) => tx.update("evaluationTimes", "mad-eval-sun-1130", { startTime: "11:15" }))),
    );
    // A fill-in at 11:00 on November 15, for missing November 8.
    const note = await miss(store, familyId, child.id, "2026-11-08");
    const fillIn = await store.transaction((tx) => sendFillIn(tx, { noteId: note.id, timeId: "mad-eval-sun-1100", date: "2026-11-15", today: TODAY, now: NOW, newId: testId }));
    await store.transaction((tx) => answerFillIn(tx, { fillInId: fillIn.id, familyId, answer: "yes", today: TODAY, now: NOW }));
    // Then the school cancels November 1: its dates leave out 11:15 on November 15.
    const [owed] = await store.transaction((tx) => cancelClassDate(tx, { classId: "mad-sun-1000-shallows", date: "2026-11-01", reason: "x", now: NOW, newId: testId }));
    const state = owedState(await store.snapshot(), owed, TODAY);
    if (state.kind !== "offer") throw new Error(state.kind);
    const slots = state.slots.map((s) => `${s.date} ${s.time.startTime}`);
    expect(slots).toContain("2026-11-08 11:15");
    expect(slots).not.toContain("2026-11-15 11:15");
  });

  it("nothing more after a no, and the missed lesson stays on the bill", async () => {
    const { store, familyId, child } = await family();
    const before = monthBill(await store.snapshot(), familyId, "2026-11-01");
    const note = await miss(store, familyId, child.id, "2026-11-08");
    const fillIn = await store.transaction((tx) => sendFillIn(tx, { noteId: note.id, timeId: "mad-eval-sun-1100", date: "2026-11-15", today: TODAY, now: NOW, newId: testId }));
    const after = monthBill(await store.snapshot(), familyId, "2026-11-01");
    expect(after.lines.map((l) => l.billed)).toEqual(before.lines.map((l) => l.billed));
    expect(after.lines).toHaveLength(before.lines.length);
    await store.transaction((tx) => answerFillIn(tx, { fillInId: fillIn.id, familyId, answer: "no", today: TODAY, now: NOW }));
    await expect(store.transaction((tx) => sendFillIn(tx, { noteId: note.id, timeId: "mad-eval-sun-1130", date: "2026-11-15", today: TODAY, now: NOW, newId: testId }))).rejects.toThrow(OfferProblemError);
  });

  it("a free evaluation that has happened isn't the next lesson", async () => {
    const { store, familyId } = await family(
      completeDraft({ kids: [{ firstName: "Ivy", birth: "2024-06-15", stage: "evaluation", booking: { kind: "evaluation", timeId: "mad-eval-sun-1100" } }], payment: "hold" }),
    );
    expect(nextLessonPerChild(await store.snapshot(), familyId, TODAY)).toHaveLength(1);
    await store.transaction((tx) => pretendFirstLesson(tx, { familyId, now: NOW, newId: testId }));
    const data = await store.snapshot();
    expect(nextLessonPerChild(data, familyId, TODAY)).toEqual([]);
    expect(lessonDaysAhead(data, familyLessons(data, familyId)[0], TODAY, 6)).toEqual([]);
  });

  it("a cancelled day is owed to who was booked into it; a noted miss isn't owed twice", async () => {
    const { store, familyId, child } = await family(completeDraft({}), devShallows);
    const note = await miss(store, familyId, child.id, "2026-11-08");
    const fillIn = await store.transaction((tx) => sendFillIn(tx, { noteId: note.id, timeId: "mad-sun-0930-pier", date: "2026-11-15", today: TODAY, now: NOW, newId: testId }));
    await store.transaction((tx) => answerFillIn(tx, { fillInId: fillIn.id, familyId, answer: "yes", today: TODAY, now: NOW }));
    expect(replacementLessons(await store.snapshot(), familyId, TODAY)).toHaveLength(1);
    // The school cancels the day the fill-in is in: Mia is owed it; and the day she told us she'll miss isn't owed again.
    const owedFill = await store.transaction((tx) => cancelClassDate(tx, { classId: "mad-sun-0930-pier", date: "2026-11-15", reason: "x", now: NOW, newId: testId }));
    expect(owedFill.map((o) => o.childRecordId)).toEqual([child.id]);
    expect(replacementLessons(await store.snapshot(), familyId, TODAY)).toEqual([]);
    const owedMissed = await store.transaction((tx) => cancelClassDate(tx, { classId: "mad-sun-1000-shallows", date: "2026-11-08", reason: "x", now: NOW, newId: testId }));
    expect(owedMissed).toEqual([]);
  });

  it("a booked fill-in goes once the family leaves the class it stood in for", async () => {
    const { store, familyId, child } = await family();
    const note = await miss(store, familyId, child.id, "2026-11-08");
    const fillIn = await store.transaction((tx) => sendFillIn(tx, { noteId: note.id, timeId: "mad-eval-sun-1100", date: "2026-11-15", today: TODAY, now: NOW, newId: testId }));
    await store.transaction((tx) => answerFillIn(tx, { fillInId: fillIn.id, familyId, answer: "yes", today: TODAY, now: NOW }));
    expect(replacementLessons(await store.snapshot(), familyId, TODAY)).toHaveLength(1);
    await store.transaction((tx) => leaveClass(tx, fillIn.enrollmentId, TODAY));
    expect(replacementLessons(await store.snapshot(), familyId, TODAY)).toEqual([]);
  });

  it("the sandbox's first lesson can be a fill-in, when it comes first, in its own slot", async () => {
    // Remy's only class is Wednesdays at 4:00 at Buckhead; Remy will miss November 11, and Coach Wren's Sunday private time is the fill-in.
    const { store, familyId, child } = await family(
      completeDraft({ poolId: "pool-buckhead", kids: [{ firstName: "Remy", birth: "2021-06-01", stage: "shallows", booking: { kind: "class", timeId: "buc-wed-1600-shallows" } }] }),
    );
    const note = await miss(store, familyId, child.id, "2026-11-11");
    const f = await store.transaction((tx) => sendFillIn(tx, { noteId: note.id, timeId: "buc-eval-sun-1130", date: "2026-11-15", today: TODAY, now: NOW, newId: testId }));
    await store.transaction((tx) => answerFillIn(tx, { fillInId: f.id, familyId, answer: "yes", today: TODAY, now: NOW }));
    expect(nextLessonPerChild(await store.snapshot(), familyId, TODAY)[0]).toMatchObject({ date: "2026-11-15", fillIn: true });
    await store.transaction((tx) => pretendFirstLesson(tx, { familyId, now: NOW, newId: testId }));
    const mark = (await store.snapshot()).attendanceMarks.find((m) => m.familyId === familyId)!;
    expect([mark.lessonDate, mark.slot, mark.instructorFirstName]).toEqual(["2026-11-15", "11:30", "Wren"]);
  });
});

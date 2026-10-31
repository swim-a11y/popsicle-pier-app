import { describe, expect, it } from "vitest";

import { LocalStore } from "@/data/store";
import type { SignUpDraft } from "@/data/types";
import { bookTime, signAndSave } from "@/rules/booking";
import { monthBill } from "@/rules/bills";
import { familyLessons, lessonDaysAhead, nextLessonPerChild, replacementLessons } from "@/rules/family";
import { answerFillIn, fillInForNote, fillInState, sendFillIn } from "@/rules/fillins";
import { notesForAPerson } from "@/rules/inbox";
import { missOptions, sendNote } from "@/rules/notes";
import { leaveClass, OfferProblemError, waitlistItems } from "@/rules/offers";
import { answerOwedOffer, answersWaiting, cancelClassDate, owedState, sendOwedOffer } from "@/rules/owed";
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

  /** Mia's November 1 lesson is cancelled; Coach Dev's Sunday 9:30 class (a Shallows class here) on November 8 is offered in its place. */
  async function newDateInClassSlot(answer: "yes" | null) {
    const ctx = await family(completeDraft({}), devShallows);
    const [owed] = await ctx.store.transaction((tx) => cancelClassDate(tx, { classId: "mad-sun-1000-shallows", date: "2026-11-01", reason: "x", now: NOW, newId: testId }));
    await ctx.store.transaction((tx) => sendOwedOffer(tx, { owedId: owed.id, timeId: "mad-sun-0930-pier", date: "2026-11-08", today: TODAY, now: NOW }));
    if (answer) await ctx.store.transaction((tx) => answerOwedOffer(tx, { owedId: owed.id, familyId: ctx.familyId, answer, today: TODAY, now: NOW }));
    return { ...ctx, owedId: owed.id };
  }

  it("a lesson marked held after a cancelled first day isn't listed as coming, or offered to miss", async () => {
    const { store, familyId, child } = await family();
    await store.transaction((tx) => cancelClassDate(tx, { classId: "mad-sun-1000-shallows", date: "2026-11-01", reason: "x", now: NOW, newId: testId }));
    await store.transaction((tx) => pretendFirstLesson(tx, { familyId, now: NOW, newId: testId }));
    const data = await store.snapshot();
    expect(data.attendanceMarks.map((m) => m.lessonDate)).toEqual(["2026-11-08"]);
    const days = lessonDaysAhead(data, familyLessons(data, familyId)[0], TODAY, 6).map((d) => d.date);
    expect(days.slice(0, 2)).toEqual(["2026-11-01", "2026-11-15"]);
    expect(missOptions(data, familyId, child.id, TODAY).map((o) => o.date)).not.toContain("2026-11-08");
  });

  it("a new date in a class slot holds its place: a new weekly booking there starts after that day", async () => {
    const { store } = await newDateInClassSlot("yes");
    const data = await store.snapshot();
    const slot = timesForChild({ data, poolId: "pool-madison", birthDate: "2022-01-01", stage: "shallows", today: TODAY }).classes.find((c) => c.id === "mad-sun-0930-pier")!;
    expect(slot.firstLessonDate).toBe("2026-11-15");
  });

  it("a booked new date whose day is cancelled is owed again; one whose day is closed isn't coming", async () => {
    const cancelled = await newDateInClassSlot("yes");
    expect(replacementLessons(await cancelled.store.snapshot(), cancelled.familyId, TODAY)).toHaveLength(1);
    const again = await cancelled.store.transaction((tx) => cancelClassDate(tx, { classId: "mad-sun-0930-pier", date: "2026-11-08", reason: "x", now: NOW, newId: testId }));
    expect(again.map((o) => [o.childRecordId, o.cancelledDate])).toEqual([[cancelled.child.id, "2026-11-08"]]);
    expect(replacementLessons(await cancelled.store.snapshot(), cancelled.familyId, TODAY)).toEqual([]);

    const closed = await newDateInClassSlot("yes");
    await closed.store.transaction((tx) => tx.add("closures", { id: "closure-test", poolId: "pool-madison", date: "2026-11-08", reason: "x" }));
    expect(replacementLessons(await closed.store.snapshot(), closed.familyId, TODAY)).toEqual([]);
  });

  it("a new date stays when the family moves to another class after the lesson it replaces, which is on their bill", async () => {
    const { store, familyId, child } = await newDateInClassSlot("yes");
    const sunday = (await store.snapshot()).enrollments.find((e) => e.childRecordId === child.id)!;
    // The family moves on Monday, November 2: the cancelled November 1 lesson was theirs, and stays on the bill while it's owed.
    await store.transaction((tx) => leaveClass(tx, sunday.id, "2026-11-02"));
    const data = await store.snapshot();
    expect(replacementLessons(data, familyId, "2026-11-02").map((l) => [l.date, l.startTime])).toEqual([["2026-11-08", "09:30"]]);
    expect(monthBill(data, familyId, "2026-11-01").lines.find((l) => l.lesson.enrollment.id === sunday.id)!.billed).toEqual(["2026-11-01"]);
  });

  it("when the family moved before the cancelled lesson, it isn't on their bill: its new date goes, and nothing is owed", async () => {
    const { store, familyId, child } = await family();
    const [owed] = await store.transaction((tx) => cancelClassDate(tx, { classId: "mad-sun-1000-shallows", date: "2026-11-08", reason: "x", now: NOW, newId: testId }));
    await store.transaction((tx) => sendOwedOffer(tx, { owedId: owed.id, timeId: "mad-eval-sun-1100", date: "2026-11-15", today: TODAY, now: NOW }));
    await store.transaction((tx) => answerOwedOffer(tx, { owedId: owed.id, familyId, answer: "yes", today: TODAY, now: NOW }));
    const sunday = (await store.snapshot()).enrollments.find((e) => e.childRecordId === child.id)!;
    await store.transaction((tx) => leaveClass(tx, sunday.id, TODAY));
    const data = await store.snapshot();
    expect(replacementLessons(data, familyId, TODAY)).toEqual([]);
    expect(owedState(data, data.owedLessons.find((o) => o.id === owed.id)!, TODAY).kind).toBe("class-ended");
    expect(monthBill(data, familyId, "2026-11-01").lines.some((l) => l.lesson.enrollment.id === sunday.id)).toBe(false);
  });

  it("an offer still waiting closes when the school cancels its day: a fill-in has closed; a new date isn't one of the two", async () => {
    const { store, familyId, child } = await family(completeDraft({}), devShallows);
    const note = await miss(store, familyId, child.id, "2026-11-01");
    const f = await store.transaction((tx) => sendFillIn(tx, { noteId: note.id, timeId: "mad-sun-0930-pier", date: "2026-11-08", today: TODAY, now: NOW, newId: testId }));
    expect(answersWaiting(await store.snapshot(), familyId, TODAY).map((a) => a.kind)).toEqual(["fill-in"]);
    await store.transaction((tx) => cancelClassDate(tx, { classId: "mad-sun-0930-pier", date: "2026-11-08", reason: "x", now: NOW, newId: testId }));
    let data = await store.snapshot();
    // The family hadn't had its fill-in: a person can offer another date that week (DECISIONS.md 141).
    expect(fillInState(data, note, TODAY)?.kind).toBe("offer");
    expect(answersWaiting(data, familyId, TODAY)).toEqual([]);
    await expect(store.transaction((tx) => answerFillIn(tx, { fillInId: f.id, familyId, answer: "yes", today: TODAY, now: NOW }))).rejects.toThrow("This fill-in has closed.");

    const owed = await newDateInClassSlot(null);
    await owed.store.transaction((tx) => cancelClassDate(tx, { classId: "mad-sun-0930-pier", date: "2026-11-08", reason: "x", now: NOW, newId: testId }));
    data = await owed.store.snapshot();
    const state = owedState(data, data.owedLessons.find((o) => o.id === owed.owedId)!, TODAY);
    expect(state).toMatchObject({ kind: "offer", round: 1 });
    expect(answersWaiting(data, owed.familyId, TODAY)).toEqual([]);
    await expect(owed.store.transaction((tx) => answerOwedOffer(tx, { owedId: owed.owedId, familyId: owed.familyId, answer: "yes", today: TODAY, now: NOW }))).rejects.toThrow("This offer has closed.");
  });

  it("a credit on a lesson owed again, after its new date was cancelled too, takes the first lesson off the bill", async () => {
    const { store, familyId } = await newDateInClassSlot("yes");
    const [again] = await store.transaction((tx) => cancelClassDate(tx, { classId: "mad-sun-0930-pier", date: "2026-11-08", reason: "x", now: NOW, newId: testId }));
    expect([again.cancelledDate, again.billedDate]).toEqual(["2026-11-08", "2026-11-01"]);
    await store.transaction((tx) => tx.update("owedLessons", again.id, { creditApprovedAt: NOW, creditApprovedBy: "the owner" }));
    const line = monthBill(await store.snapshot(), familyId, "2026-11-01").lines.find((l) => l.lesson.enrollment.timeId === "mad-sun-1000-shallows")!;
    expect(line.billed).not.toContain("2026-11-01");
    expect(line.cancelled).toEqual([{ date: "2026-11-01", credited: true }]);
  });

  it("cancelling a day owes no fill-in whose class has ended, and a one-off isn't skipped for a miss of that day's weekly lesson", async () => {
    const left = await family(completeDraft({}), devShallows);
    const note = await miss(left.store, left.familyId, left.child.id, "2026-11-01");
    const f = await left.store.transaction((tx) => sendFillIn(tx, { noteId: note.id, timeId: "mad-sun-0930-pier", date: "2026-11-08", today: TODAY, now: NOW, newId: testId }));
    await left.store.transaction((tx) => answerFillIn(tx, { fillInId: f.id, familyId: left.familyId, answer: "yes", today: TODAY, now: NOW }));
    await left.store.transaction((tx) => leaveClass(tx, f.enrollmentId, TODAY));
    expect(await left.store.transaction((tx) => cancelClassDate(tx, { classId: "mad-sun-0930-pier", date: "2026-11-08", reason: "x", now: NOW, newId: testId }))).toEqual([]);

    // Mia's new date is Sunday, November 8 at 9:30; she'll miss her 10:00 class that day. Cancelling 9:30 still owes the new date.
    const both = await newDateInClassSlot("yes");
    await miss(both.store, both.familyId, both.child.id, "2026-11-08");
    const owed = await both.store.transaction((tx) => cancelClassDate(tx, { classId: "mad-sun-0930-pier", date: "2026-11-08", reason: "x", now: NOW, newId: testId }));
    expect(owed.map((o) => o.childRecordId)).toEqual([both.child.id]);
  });

  it("a date the family let lapse still counts once the school cancels its day; one cancelled while open doesn't", async () => {
    const lapsed = await newDateInClassSlot(null);
    // The answer-by day, Friday, November 6, has passed when the school cancels on Saturday, November 7.
    await lapsed.store.transaction((tx) => cancelClassDate(tx, { classId: "mad-sun-0930-pier", date: "2026-11-08", reason: "x", now: "2026-11-07T15:00:00.000Z", newId: testId }));
    let data = await lapsed.store.snapshot();
    expect(owedState(data, data.owedLessons.find((o) => o.id === lapsed.owedId)!, "2026-11-07")).toMatchObject({ round: 2 });
    const open = await newDateInClassSlot(null);
    await open.store.transaction((tx) => cancelClassDate(tx, { classId: "mad-sun-0930-pier", date: "2026-11-08", reason: "x", now: NOW, newId: testId }));
    data = await open.store.snapshot();
    expect(owedState(data, data.owedLessons.find((o) => o.id === open.owedId)!, "2026-11-07")).toMatchObject({ round: 1 });
  });

  it("after the school closes a fill-in before the family answers, a person can offer another that week, and the inbox lists the note again", async () => {
    const { store, familyId, child } = await family(completeDraft({}), devShallows);
    const note = await miss(store, familyId, child.id, "2026-11-01");
    await store.transaction((tx) => sendFillIn(tx, { noteId: note.id, timeId: "mad-sun-0930-pier", date: "2026-11-08", today: TODAY, now: NOW, newId: testId }));
    expect(notesForAPerson(await store.snapshot(), TODAY)).toEqual([]);
    await store.transaction((tx) => cancelClassDate(tx, { classId: "mad-sun-0930-pier", date: "2026-11-08", reason: "x", now: NOW, newId: testId }));
    expect(notesForAPerson(await store.snapshot(), TODAY).map((n) => n.id)).toEqual([note.id]);
    const second = await store.transaction((tx) => sendFillIn(tx, { noteId: note.id, timeId: "mad-eval-sun-1100", date: "2026-11-08", today: TODAY, now: NOW, newId: testId }));
    let data = await store.snapshot();
    expect(fillInForNote(data, note.id)?.id).toBe(second.id);
    expect(fillInState(data, note, TODAY)?.kind).toBe("waiting");
    expect(notesForAPerson(data, TODAY)).toEqual([]);
    await store.transaction((tx) => answerFillIn(tx, { fillInId: second.id, familyId, answer: "yes", today: TODAY, now: NOW }));
    data = await store.snapshot();
    expect(replacementLessons(data, familyId, TODAY).map((l) => [l.date, l.startTime])).toEqual([["2026-11-08", "11:00"]]);
  });

  it("a fill-in still waiting closes when its class ends, or when the pool closes its day", async () => {
    const ended = await family();
    const a = await miss(ended.store, ended.familyId, ended.child.id, "2026-11-08");
    const f = await ended.store.transaction((tx) => sendFillIn(tx, { noteId: a.id, timeId: "mad-eval-sun-1100", date: "2026-11-15", today: TODAY, now: NOW, newId: testId }));
    await ended.store.transaction((tx) => leaveClass(tx, f.enrollmentId, TODAY));
    expect(answersWaiting(await ended.store.snapshot(), ended.familyId, TODAY)).toEqual([]);
    await expect(ended.store.transaction((tx) => answerFillIn(tx, { fillInId: f.id, familyId: ended.familyId, answer: "yes", today: TODAY, now: NOW }))).rejects.toThrow("This fill-in has closed.");

    const closed = await family();
    const b = await miss(closed.store, closed.familyId, closed.child.id, "2026-11-08");
    const g = await closed.store.transaction((tx) => sendFillIn(tx, { noteId: b.id, timeId: "mad-eval-sun-1100", date: "2026-11-15", today: TODAY, now: NOW, newId: testId }));
    await closed.store.transaction((tx) => tx.add("closures", { id: "closure-test", poolId: "pool-madison", date: "2026-11-15", reason: "x" }));
    expect(answersWaiting(await closed.store.snapshot(), closed.familyId, TODAY)).toEqual([]);
    await expect(closed.store.transaction((tx) => answerFillIn(tx, { fillInId: g.id, familyId: closed.familyId, answer: "yes", today: TODAY, now: NOW }))).rejects.toThrow("This fill-in has closed.");
  });

  it("a new date on a day the school then cancels holds no place: a new weekly booking can start sooner", async () => {
    const { store } = await newDateInClassSlot("yes");
    await store.transaction((tx) => cancelClassDate(tx, { classId: "mad-sun-0930-pier", date: "2026-11-08", reason: "x", now: NOW, newId: testId }));
    const slot = timesForChild({ data: await store.snapshot(), poolId: "pool-madison", birthDate: "2022-01-01", stage: "shallows", today: TODAY }).classes.find((c) => c.id === "mad-sun-0930-pier")!;
    expect(slot.firstLessonDate).toBe("2026-11-01");
  });

  it("waiting for any time that fits never offers a class on the same day and time as the child's own", async () => {
    const { store, child } = await family();
    await store.transaction((tx) => tx.add("waitlistEntries", { id: "w-any", familyId: child.familyId, childRecordId: child.id, poolId: "pool-madison", classId: null, fromNoteId: null, createdAt: NOW }));
    await store.transaction((tx) => tx.update("classes", "mad-sun-0930-pier", { stageId: "shallows", startTime: "10:00", maxAgeMonths: 83 }));
    const [item] = waitlistItems(await store.snapshot(), TODAY);
    expect(item.open.map((o) => o.cls.id)).not.toContain("mad-sun-0930-pier");
  });
});

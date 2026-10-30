import { describe, expect, it } from "vitest";

import { LocalStore } from "@/data/store";
import type { SignUpDraft } from "@/data/types";
import { signAndSave, TimeFilledError, bookTime } from "@/rules/booking";
import { familyLessons, lessonDaysAhead, nextLessonPerChild } from "@/rules/family";
import { doneItems, flagAnswers, inboxCounts, recordTalk, talkItems } from "@/rules/inbox";
import { answerWaitlistOffer, OfferProblemError, sendWaitlistOffer, waitlistItems } from "@/rules/offers";
import { answerOwedOffer, approveOwedCredit, bookedOwedDates, cancelClassDate, owedState, sendOwedOffer } from "@/rules/owed";
import { timesForChild } from "@/rules/times";
import { buildSeed } from "@/sandbox/seed";
import { pretendFirstLesson } from "@/sandbox/pretend-first-lesson";
import { pretendFamilyLeft, pretendSchoolCancelled } from "@/sandbox/pretend-school";

import { completeDraft, memoryStorage, NOW, testId, TODAY } from "./helpers";

const flat = (s: string) => s.replace(/\s+/g, " ");

async function signedUp(draft: SignUpDraft) {
  const store = new LocalStore({ seedVersion: "t", seed: buildSeed, storage: memoryStorage() });
  await store.transaction((tx) => tx.add("signUpDrafts", draft));
  const { familyId } = await store.transaction((tx) => signAndSave(tx, { draft, today: TODAY, now: NOW, browserName: "Chrome", newId: testId }));
  return { store, familyId };
}

/** Like walk-through 2's Ada: booked Sundays at 10:00 at Buckhead, waiting for the full 9:00 class, with a custody yes. */
const adaDraft = (payment: "bank" | "none" = "bank", booked = true) =>
  completeDraft({
    poolId: "pool-buckhead",
    payment,
    kids: [{ firstName: "Ada", birth: "2020-05-30", stage: "cove", booking: booked ? { kind: "class", timeId: "buc-sun-1000-cove" } : null, waitlist: ["buc-sun-0900-cove"], custodyYes: true }],
  });

describe("the approvals inbox: waitlist offers", () => {
  it("a person offers an open spot in place of a class; the family's yes books it", async () => {
    const { store, familyId } = await signedUp(adaDraft());
    let data = await store.snapshot();
    let [item] = waitlistItems(data, TODAY);
    expect(item.child.firstName).toBe("Ada");
    expect(item.open).toEqual([]);
    // Sandbox: a sample family leaves the full class. Its partner starts the unpaired month again.
    expect(await store.transaction((tx) => pretendFamilyLeft(tx, { today: TODAY }))).toEqual(["buc-sun-0900-cove"]);
    data = await store.snapshot();
    expect(data.classes.find((c) => c.id === "buc-sun-0900-cove")!.openSpots).toBe(1);
    const partner = data.enrollments.filter((e) => e.timeId === "buc-sun-0900-cove" && !e.endedOn);
    expect(partner).toHaveLength(1);
    expect(partner[0].unpairedSince).toBe("2026-11-08");
    [item] = waitlistItems(data, TODAY);
    expect(item.open.map((o) => o.cls.id)).toEqual(["buc-sun-0900-cove"]);
    const tenOClock = item.ownClasses[0].enrollment;
    const offer = await store.transaction((tx) => sendWaitlistOffer(tx, { entryId: item.entry.id, classId: "buc-sun-0900-cove", inPlaceOfEnrollmentId: tenOClock.id, today: TODAY, now: NOW, newId: testId }));
    expect(flat(offer.words)).toBe(
      "A spot opened for Ada in the Sunday 9:00 am class at Buckhead, with Coach Wren. Would you like Ada to move there from the Sunday 10:00 am class? Please answer by Friday, November 6.",
    );
    // The spot is held for Ada while the family answers: nobody else can book it, and no second offer goes out.
    data = await store.snapshot();
    const other = timesForChild({ data, poolId: "pool-buckhead", birthDate: "2020-01-01", stage: "cove", today: TODAY }).classes.find((c) => c.id === "buc-sun-0900-cove")!;
    expect(other.full).toBe(true);
    await expect(store.transaction((tx) => bookTime(tx, { familyId: "family-marlow", childRecordId: "child-ari", booking: { kind: "class", timeId: "buc-sun-0900-cove" }, poolId: "pool-buckhead", today: TODAY, now: NOW, newId: testId, alone: false }))).rejects.toThrow(TimeFilledError);
    await expect(store.transaction((tx) => sendWaitlistOffer(tx, { entryId: item.entry.id, classId: "buc-sun-0900-cove", inPlaceOfEnrollmentId: null, today: TODAY, now: NOW, newId: testId }))).rejects.toThrow(OfferProblemError);
    expect(inboxCounts(data, TODAY).waitlist).toBe(0);

    const answered = await store.transaction((tx) => answerWaitlistOffer(tx, { offerId: offer.id, familyId, answer: "yes", today: TODAY, now: NOW, newId: testId }));
    data = await store.snapshot();
    const lessons = familyLessons(data, familyId);
    expect(lessons.map((l) => [l.enrollment.timeId, l.firstLessonDate])).toEqual([["buc-sun-0900-cove", "2026-11-08"]]);
    expect(answered).toMatchObject({ answer: "yes", enrollmentId: lessons[0].enrollment.id });
    expect(data.waitlistEntries.filter((w) => w.familyId === familyId)).toEqual([]);
    expect(data.classes.find((c) => c.id === "buc-sun-0900-cove")!.openSpots).toBe(0);
    expect(data.classes.find((c) => c.id === "buc-sun-1000-cove")!.openSpots).toBe(2);
    expect(flat(doneItems(data, TODAY)[0].line)).toBe("Offered Ada the Sunday 9:00 am class. They said yes.");
  });

  it("a no keeps the child on the waitlist; an offer not answered in a week closes", async () => {
    const { store, familyId } = await signedUp(adaDraft());
    await store.transaction((tx) => pretendFamilyLeft(tx, { today: TODAY }));
    const send = async () => {
      const [item] = waitlistItems(await store.snapshot(), TODAY);
      return store.transaction((tx) => sendWaitlistOffer(tx, { entryId: item.entry.id, classId: "buc-sun-0900-cove", inPlaceOfEnrollmentId: null, today: TODAY, now: NOW, newId: testId }));
    };
    const first = await send();
    await store.transaction((tx) => answerWaitlistOffer(tx, { offerId: first.id, familyId, answer: "no", today: TODAY, now: NOW, newId: testId }));
    let data = await store.snapshot();
    expect(data.waitlistEntries.filter((w) => w.familyId === familyId)).toHaveLength(1);
    expect(waitlistItems(data, TODAY)[0]).toMatchObject({ pending: null });
    expect(waitlistItems(data, TODAY)[0].open).toHaveLength(1);
    const second = await send();
    expect(second.answerBy).toBe("2026-11-06");
    await expect(store.transaction((tx) => answerWaitlistOffer(tx, { offerId: second.id, familyId, answer: "yes", today: "2026-11-07", now: NOW, newId: testId }))).rejects.toThrow("This offer has closed.");
    data = await store.snapshot();
    expect(waitlistItems(data, "2026-11-07")[0].pending).toBeNull();
  });

  it("a family with no way to pay for lessons sets that up with a person before an offer", async () => {
    const { store } = await signedUp(adaDraft("none", false));
    await store.transaction((tx) => pretendFamilyLeft(tx, { today: TODAY }));
    const [item] = waitlistItems(await store.snapshot(), TODAY);
    expect(item.canPay).toBe(false);
    await expect(store.transaction((tx) => sendWaitlistOffer(tx, { entryId: item.entry.id, classId: "buc-sun-0900-cove", inPlaceOfEnrollmentId: null, today: TODAY, now: NOW, newId: testId }))).rejects.toThrow(
      "This family hasn't set up how they'll pay for lessons yet.",
    );
  });
});

describe("the approvals inbox: owed lessons", () => {
  async function cancelled() {
    const { store, familyId } = await signedUp(completeDraft({}));
    const result = await store.transaction((tx) => pretendSchoolCancelled(tx, { familyId, today: TODAY, now: NOW, newId: testId }));
    const data = await store.snapshot();
    const owed = data.owedLessons.find((o) => o.familyId === familyId)!;
    return { store, familyId, result, owed };
  }

  it("a lesson the school cancels is owed, skipped, and offered with the child's own coach within three weeks", async () => {
    const { store, familyId, result, owed } = await cancelled();
    expect(result).toEqual({ childFirstName: "Mia", date: "2026-11-01" });
    const data = await store.snapshot();
    expect(owed).toMatchObject({ cancelledDate: "2026-11-01", instructorFirstName: "Dev", offers: [], creditApprovedAt: null });
    expect(nextLessonPerChild(data, familyId, TODAY)[0].date).toBe("2026-11-08");
    expect(lessonDaysAhead(data, familyLessons(data, familyId)[0], TODAY, 2)[0]).toEqual({ date: "2026-11-01", closedReason: null, cancelledReason: "Coach Dev is away that day (sample)" });
    const state = owedState(data, owed, TODAY);
    if (state.kind !== "offer") throw new Error(state.kind);
    // Coach Dev's Pier class doesn't fit Mia's stage, and her own class is hers already: his private times do.
    expect(state.slots.map((s) => `${s.kind} ${s.date} ${s.time.startTime}`)).toEqual([
      "evaluation 2026-11-08 11:00",
      "evaluation 2026-11-08 11:30",
      "evaluation 2026-11-15 11:00",
      "evaluation 2026-11-15 11:30",
      "evaluation 2026-11-22 11:00",
      "evaluation 2026-11-22 11:30",
    ]);
  });

  it("one date, a week to answer, one more date, then it closes with no credit", async () => {
    const { store, familyId, owed } = await cancelled();
    const offer = await store.transaction((tx) => sendOwedOffer(tx, { owedId: owed.id, timeId: "mad-eval-sun-1100", date: "2026-11-08", today: TODAY, now: NOW }));
    expect(flat(offer.words)).toBe(
      "We cancelled Mia's lesson on Sunday, November 1. We can offer Sunday, November 8 at 11:00 am with Coach Dev at Madison instead. Does that work? Please answer by Friday, November 6.",
    );
    // The date is held: a new free evaluation that day starts the week after.
    const later = "2026-11-02";
    const evalFirst = timesForChild({ data: await store.snapshot(), poolId: "pool-madison", birthDate: "2022-01-01", stage: "evaluation", today: later }).evaluations.find((e) => e.id === "mad-eval-sun-1100")!;
    expect(evalFirst.firstLessonDate).toBe("2026-11-15");
    await expect(store.transaction((tx) => sendOwedOffer(tx, { owedId: owed.id, timeId: "mad-eval-sun-1130", date: "2026-11-08", today: TODAY, now: NOW }))).rejects.toThrow(OfferProblemError);
    // No answer by Friday counts as a no: one more date.
    let state = owedState(await store.snapshot(), (await store.snapshot()).owedLessons.find((o) => o.id === owed.id)!, "2026-11-07");
    expect(state).toMatchObject({ kind: "offer", round: 2 });
    await store.transaction((tx) => answerOwedOffer(tx, { owedId: owed.id, familyId, answer: "no", today: TODAY, now: NOW }));
    const second = await store.transaction((tx) => sendOwedOffer(tx, { owedId: owed.id, timeId: "mad-eval-sun-1130", date: "2026-11-15", today: TODAY, now: NOW }));
    expect(flat(second.words)).toBe("One more date for Mia's lesson we cancelled on Sunday, November 1: Sunday, November 15 at 11:30 am with Coach Dev at Madison. Does that work? Please answer by Friday, November 6.");
    await store.transaction((tx) => answerOwedOffer(tx, { owedId: owed.id, familyId, answer: "no", today: TODAY, now: NOW }));
    const data = await store.snapshot();
    state = owedState(data, data.owedLessons.find((o) => o.id === owed.id)!, TODAY);
    expect(state.kind).toBe("closed");
    await expect(store.transaction((tx) => approveOwedCredit(tx, { owedId: owed.id, today: TODAY, now: NOW }))).rejects.toThrow("A credit is only for when no opening exists.");
    expect(doneItems(data, TODAY).map((d) => flat(d.line))).toContain("Closed with no credit: Mia's lesson on Sunday, November 1.");
  });

  it("a yes books the date the person offered", async () => {
    const { store, familyId, owed } = await cancelled();
    await store.transaction((tx) => sendOwedOffer(tx, { owedId: owed.id, timeId: "mad-eval-sun-1100", date: "2026-11-15", today: TODAY, now: NOW }));
    await store.transaction((tx) => answerOwedOffer(tx, { owedId: owed.id, familyId, answer: "yes", today: TODAY, now: NOW }));
    const data = await store.snapshot();
    expect(owedState(data, data.owedLessons[0], TODAY).kind).toBe("booked");
    expect(bookedOwedDates(data, owed.childRecordId).map((b) => [b.offer.date, b.time.startTime])).toEqual([["2026-11-15", "11:00"]]);
    await expect(store.transaction((tx) => answerOwedOffer(tx, { owedId: owed.id, familyId, answer: "no", today: TODAY, now: NOW }))).rejects.toThrow("This offer has closed.");
  });

  it("a credit only when no opening exists, and only by the owner's approval", async () => {
    const { store, owed } = await cancelled();
    await expect(store.transaction((tx) => approveOwedCredit(tx, { owedId: owed.id, today: TODAY, now: NOW }))).rejects.toThrow(OfferProblemError);
    await store.transaction((tx) => {
      for (const id of ["mad-eval-sun-1100", "mad-eval-sun-1130"]) tx.update("evaluationTimes", id, { openSpots: 0 });
    });
    let data = await store.snapshot();
    expect(owedState(data, data.owedLessons[0], TODAY)).toEqual({ kind: "no-opening", round: 1 });
    expect(inboxCounts(data, TODAY).owed).toBe(1);
    await store.transaction((tx) => approveOwedCredit(tx, { owedId: owed.id, today: TODAY, now: NOW }));
    data = await store.snapshot();
    expect(owedState(data, data.owedLessons[0], TODAY).kind).toBe("credited");
    expect(data.owedLessons[0].creditApprovedBy).toBe("the owner");
    expect(inboxCounts(data, TODAY).owed).toBe(0);
  });

  it("never before the cancelled lesson, always a full week to answer, and never on a closed day", async () => {
    const { store, familyId } = await signedUp(completeDraft({}));
    // Cancel Mia's November 8 lesson: dates start after it, at least 8 days out, and stop three weeks on.
    const [owed] = await store.transaction((tx) => cancelClassDate(tx, { classId: "mad-sun-1000-shallows", date: "2026-11-08", reason: "Coach Dev is away that day (sample)", now: NOW, newId: testId }));
    const state = owedState(await store.snapshot(), owed, TODAY);
    if (state.kind !== "offer") throw new Error(state.kind);
    for (const s of state.slots) {
      expect(s.date > "2026-11-08").toBe(true);
      expect(s.date >= "2026-11-07").toBe(true);
      expect(s.date <= "2026-11-29").toBe(true);
    }
    expect(state.slots.map((s) => s.date)).not.toContain("2026-11-29");
    const offer = await store.transaction((tx) => sendOwedOffer(tx, { owedId: owed.id, timeId: state.slots[0].time.id, date: state.slots[0].date, today: TODAY, now: NOW }));
    expect(offer.answerBy).toBe("2026-11-06");
    // A closed day has no lesson to cancel.
    expect(await store.transaction((tx) => cancelClassDate(tx, { classId: "mad-sun-1000-shallows", date: "2026-11-29", reason: "x", now: NOW, newId: testId }))).toEqual([]);
    expect((await store.snapshot()).owedLessons.filter((o) => o.familyId === familyId)).toHaveLength(1);
  });

  it("cancelling the same date twice adds nothing", async () => {
    const { store, familyId } = await cancelled();
    const again = await store.transaction((tx) => pretendSchoolCancelled(tx, { familyId, today: TODAY, now: NOW, newId: testId }));
    // The next lesson (November 8) is cancelled now, a different date.
    expect(again).toEqual({ childFirstName: "Mia", date: "2026-11-08" });
    expect((await store.snapshot()).owedLessons).toHaveLength(2);
  });
});

describe("the approvals inbox: talk with a family first", () => {
  it("a custody or health yes waits for a person, who records the talk; the flag clears", async () => {
    const { store, familyId } = await signedUp(adaDraft());
    let data = await store.snapshot();
    const ada = data.children.find((c) => c.familyId === familyId)!;
    expect(flagAnswers(data, ada.id)).toEqual({ custody: true, health: false });
    const [item] = talkItems(data, TODAY);
    expect(item).toMatchObject({ custody: true, health: false, next: { date: "2026-11-08", poolName: "Buckhead" } });
    expect(inboxCounts(data, TODAY).talks).toBe(1);
    const talk = await store.transaction((tx) => recordTalk(tx, { childRecordId: ada.id, now: NOW, newId: testId }));
    data = await store.snapshot();
    expect(data.children.find((c) => c.id === ada.id)!.flaggedForPerson).toBe(false);
    expect(talkItems(data, TODAY)).toEqual([]);
    await expect(store.transaction((tx) => recordTalk(tx, { childRecordId: ada.id, now: NOW, newId: testId }))).rejects.toThrow(OfferProblemError);
    expect(data.talkRecords).toEqual([talk]);
    expect(doneItems(data, TODAY)[0].line).toMatch(/^Talked with Jordan Sample about Ada/);
  });

  it("the first lesson waits for the talk: the sandbox's first lesson skips the child until a person records it", async () => {
    const { store, familyId } = await signedUp(adaDraft());
    const first = await store.transaction((tx) => pretendFirstLesson(tx, { familyId, now: NOW, newId: testId }));
    expect(first).toEqual({ added: 0, held: ["Ada"] });
    expect((await store.snapshot()).attendanceMarks.filter((m) => m.familyId === familyId)).toEqual([]);
    const ada = (await store.snapshot()).children.find((c) => c.familyId === familyId)!;
    await store.transaction((tx) => recordTalk(tx, { childRecordId: ada.id, now: NOW, newId: testId }));
    expect(await store.transaction((tx) => pretendFirstLesson(tx, { familyId, now: NOW, newId: testId }))).toEqual({ added: 1, held: [] });
  });
});

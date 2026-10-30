import { describe, expect, it } from "vitest";

import { LocalStore } from "@/data/store";
import { signAndSave } from "@/rules/booking";
import { familyLessons } from "@/rules/family";
import { sendNote } from "@/rules/notes";
import { answerWaitlistOffer, differentTimes, OfferProblemError, offerDifferentTime, sendWaitlistOffer, waitForDifferentTime, waitlistItems } from "@/rules/offers";
import { pretendFamilyLeft } from "@/sandbox/pretend-school";
import { buildSeed } from "@/sandbox/seed";

import { completeDraft, memoryStorage, NOW, testId, TODAY } from "./helpers";

const flat = (s: string) => s.replace(/\s+/g, " ");

/** Jules, 3, in the Sunday 9:30 Pier class at Madison, asks for a different time. */
async function julesAsks(kind: "move" | "stop" = "move", kid = { firstName: "Jules", birth: "2023-06-15", stage: "pier" as const, timeId: "mad-sun-0930-pier" }) {
  const store = new LocalStore({ seedVersion: "t", seed: buildSeed, storage: memoryStorage() });
  const draft = completeDraft({ kids: [{ firstName: kid.firstName, birth: kid.birth, stage: kid.stage, booking: { kind: "class", timeId: kid.timeId } }] });
  await store.transaction((tx) => tx.add("signUpDrafts", draft));
  const { familyId } = await store.transaction((tx) => signAndSave(tx, { draft, today: TODAY, now: NOW, browserName: "Chrome", newId: testId }));
  const child = (await store.snapshot()).children.find((c) => c.familyId === familyId)!;
  const note = await store.transaction((tx) => sendNote(tx, { familyId, childRecordId: child.id, kind, today: TODAY, now: NOW, newId: testId }));
  return { store, familyId, child, note };
}

/** Mia, 4, in the Sunday 10:00 Shallows class at Madison, asks for a different time. */
const mia = { firstName: "Mia", birth: "2022-07-30", stage: "shallows" as never, timeId: "mad-sun-1000-shallows" };

/** A sample family leaves Madison's full Wednesday 4:30 Shallows class: a different time that fits Mia, at her own pool. */
const wednesdayOpens = (store: LocalStore) => store.transaction((tx) => tx.update("classes", "mad-wed-1630-shallows", { openSpots: 1 }));

describe("a different time, after a family's note", () => {
  it("lists open times that fit at the child's own pool, never their own class, a full one, another pool, or the same day and time", async () => {
    const { store, child } = await julesAsks("move", mia);
    // Wednesday 4:30 at Madison is full, and Buckhead's open Wednesday Shallows class is another pool, not another time.
    expect(differentTimes(await store.snapshot(), child.id, TODAY)).toEqual([]);
    await wednesdayOpens(store);
    expect(differentTimes(await store.snapshot(), child.id, TODAY).map((t) => t.cls.id)).toEqual(["mad-wed-1630-shallows"]);
    // Another Shallows class on Sundays at 10:00 is another coach, not another time.
    await store.transaction((tx) => tx.update("classes", "mad-sun-0930-pier", { stageId: "shallows", startTime: "10:00", maxAgeMonths: 83 }));
    expect(differentTimes(await store.snapshot(), child.id, TODAY).map((t) => t.cls.id)).toEqual(["mad-wed-1630-shallows"]);
  });

  it("a person offers one in place of the child's class; the family's yes moves them; the note is read", async () => {
    const { store, familyId, child, note } = await julesAsks("move", mia);
    await wednesdayOpens(store);
    const own = familyLessons(await store.snapshot(), familyId)[0];
    const offer = await store.transaction((tx) => offerDifferentTime(tx, { noteId: note.id, classId: "mad-wed-1630-shallows", inPlaceOfEnrollmentId: own.enrollment.id, today: TODAY, now: NOW, newId: testId }));
    expect(flat(offer.words)).toBe(
      "You asked about a different time for Mia. A place opened in the Wednesday 4:30 pm class at Madison. If you say yes, Mia moves there, and the Sunday 10:00 am class ends the day you say yes. If you say no, or don't answer, Mia keeps the Sunday 10:00 am class and stays on the Madison waitlist. Please answer by Friday, November 6.",
    );
    expect(offer.fromNoteId).toBe(note.id);
    let data = await store.snapshot();
    expect(data.familyNotes.find((n) => n.id === note.id)!.readAt).toBe(NOW);
    // What the family asked for: any time that fits at their pool.
    expect(data.waitlistEntries.filter((w) => w.childRecordId === child.id).map((w) => [w.poolId, w.classId, w.fromNoteId])).toEqual([["pool-madison", null, note.id]]);
    await store.transaction((tx) => answerWaitlistOffer(tx, { offerId: offer.id, familyId, answer: "yes", today: TODAY, now: NOW, newId: testId }));
    data = await store.snapshot();
    expect(familyLessons(data, familyId).map((l) => l.enrollment.timeId)).toEqual(["mad-wed-1630-shallows"]);
    expect(data.waitlistEntries.filter((w) => w.childRecordId === child.id)).toEqual([]);
  });

  it("a no keeps the child waiting for any time that fits there", async () => {
    const { store, familyId, note } = await julesAsks("move", mia);
    await wednesdayOpens(store);
    const own = familyLessons(await store.snapshot(), familyId)[0];
    const offer = await store.transaction((tx) => offerDifferentTime(tx, { noteId: note.id, classId: "mad-wed-1630-shallows", inPlaceOfEnrollmentId: own.enrollment.id, today: TODAY, now: NOW, newId: testId }));
    await store.transaction((tx) => answerWaitlistOffer(tx, { offerId: offer.id, familyId, answer: "no", today: TODAY, now: NOW, newId: testId }));
    const data = await store.snapshot();
    expect(familyLessons(data, familyId).map((l) => l.enrollment.timeId)).toEqual(["mad-sun-1000-shallows"]);
    expect(waitlistItems(data, TODAY).map((i) => [i.child.firstName, i.wanted])).toEqual([["Mia", null]]);
  });

  it("with nothing open, a person puts the child on the waitlist instead, once", async () => {
    // Jules's Pier class is the only one at Madison that fits; Buckhead's Pier class is another pool.
    const { store, child, note } = await julesAsks();
    expect(differentTimes(await store.snapshot(), child.id, TODAY)).toEqual([]);
    await store.transaction((tx) => waitForDifferentTime(tx, { noteId: note.id, poolId: "pool-madison", now: NOW, newId: testId }));
    await store.transaction((tx) => waitForDifferentTime(tx, { noteId: note.id, poolId: "pool-madison", now: NOW, newId: testId }));
    const data = await store.snapshot();
    expect(data.waitlistEntries.filter((w) => w.childRecordId === child.id).map((w) => [w.poolId, w.classId, w.fromNoteId])).toEqual([["pool-madison", null, note.id]]);
    expect(data.familyNotes.find((n) => n.id === note.id)!.readAt).toBe(NOW);
  });

  it("one open offer per child: a second note can't send a second offer, and the child keeps one waitlist there", async () => {
    const { store, familyId, child, note } = await julesAsks("move", mia);
    await wednesdayOpens(store);
    const own = familyLessons(await store.snapshot(), familyId)[0];
    const first = await store.transaction((tx) => offerDifferentTime(tx, { noteId: note.id, classId: "mad-wed-1630-shallows", inPlaceOfEnrollmentId: own.enrollment.id, today: TODAY, now: NOW, newId: testId }));
    // The first note is read, so the family can send another.
    const second = await store.transaction((tx) => sendNote(tx, { familyId, childRecordId: child.id, kind: "move", today: TODAY, now: NOW, newId: testId }));
    await expect(
      store.transaction((tx) => offerDifferentTime(tx, { noteId: second.id, classId: "mad-wed-1630-shallows", inPlaceOfEnrollmentId: own.enrollment.id, today: TODAY, now: NOW, newId: testId })),
    ).rejects.toThrow("An offer is already waiting for this family's answer.");
    let data = await store.snapshot();
    expect(data.waitlistOffers.filter((o) => o.childRecordId === child.id)).toHaveLength(1);
    // After a no, the second note's offer goes out from the same waitlist.
    await store.transaction((tx) => answerWaitlistOffer(tx, { offerId: first.id, familyId, answer: "no", today: TODAY, now: NOW, newId: testId }));
    await store.transaction((tx) => offerDifferentTime(tx, { noteId: second.id, classId: "mad-wed-1630-shallows", inPlaceOfEnrollmentId: own.enrollment.id, today: TODAY, now: NOW, newId: testId }));
    data = await store.snapshot();
    expect(data.waitlistEntries.filter((w) => w.childRecordId === child.id).map((w) => w.fromNoteId)).toEqual([second.id]);
    expect(data.waitlistOffers.filter((o) => o.childRecordId === child.id && o.answer === null)).toHaveLength(1);
  });

  it("once a full class that fits opens, the offer from that waitlist answers the family's note", async () => {
    const { store, familyId, child, note } = await julesAsks("move", mia);
    expect(differentTimes(await store.snapshot(), child.id, TODAY)).toEqual([]);
    await store.transaction((tx) => waitForDifferentTime(tx, { noteId: note.id, poolId: "pool-madison", now: NOW, newId: testId }));
    // The sandbox: a sample family leaves the full Wednesday 4:30 class, which fits Mia.
    expect(await store.transaction((tx) => pretendFamilyLeft(tx, { today: TODAY }))).toEqual(["mad-wed-1630-shallows"]);
    const [item] = waitlistItems(await store.snapshot(), TODAY);
    expect(item.open.map((o) => o.cls.id)).toEqual(["mad-wed-1630-shallows"]);
    const own = familyLessons(await store.snapshot(), familyId)[0];
    const offer = await store.transaction((tx) => sendWaitlistOffer(tx, { entryId: item.entry.id, classId: "mad-wed-1630-shallows", inPlaceOfEnrollmentId: own.enrollment.id, today: TODAY, now: NOW, newId: testId }));
    expect(offer.fromNoteId).toBe(note.id);
    expect(flat(offer.words)).toContain("You asked about a different time for Mia. A place opened in the Wednesday 4:30 pm class at Madison.");
  });

  it("only for a different-time note", async () => {
    const { store, familyId, note } = await julesAsks("stop");
    const own = familyLessons(await store.snapshot(), familyId)[0];
    await expect(
      store.transaction((tx) => offerDifferentTime(tx, { noteId: note.id, classId: "buc-sun-0930-pier", inPlaceOfEnrollmentId: own.enrollment.id, today: TODAY, now: NOW, newId: testId })),
    ).rejects.toThrow(OfferProblemError);
  });
});

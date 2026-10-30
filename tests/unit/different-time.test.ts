import { describe, expect, it } from "vitest";

import { LocalStore } from "@/data/store";
import { signAndSave } from "@/rules/booking";
import { familyLessons } from "@/rules/family";
import { sendNote } from "@/rules/notes";
import { answerWaitlistOffer, differentTimes, OfferProblemError, offerDifferentTime, waitForDifferentTime, waitlistItems } from "@/rules/offers";
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

describe("a different time, after a family's note", () => {
  it("lists open times that fit at either pool, never the child's own class or a full one", async () => {
    const { store, child } = await julesAsks();
    const times = differentTimes(await store.snapshot(), child.id, TODAY);
    expect(times.map((t) => t.cls.id)).toEqual(["buc-sun-0930-pier"]);
  });

  it("a person offers one in place of the child's class; the family's yes moves them; the note is read", async () => {
    const { store, familyId, child, note } = await julesAsks();
    const own = familyLessons(await store.snapshot(), familyId)[0];
    const offer = await store.transaction((tx) => offerDifferentTime(tx, { noteId: note.id, classId: "buc-sun-0930-pier", inPlaceOfEnrollmentId: own.enrollment.id, today: TODAY, now: NOW, newId: testId }));
    expect(flat(offer.words)).toBe(
      "You asked about a different time for Jules. There's a place in the Sunday 9:30 am class at Buckhead, with Coach Wren. If you say yes, Jules moves there from the Sunday 9:30 am class at Madison, with Coach Dev, and that class ends for Jules. If you say no, or don't answer, Jules keeps that class and stays on the Buckhead waitlist for a time that fits. Please answer by Friday, November 6.",
    );
    let data = await store.snapshot();
    expect(data.familyNotes.find((n) => n.id === note.id)!.readAt).toBe(NOW);
    // What the family asked for: any time that fits at that pool.
    expect(data.waitlistEntries.filter((w) => w.childRecordId === child.id).map((w) => [w.poolId, w.classId])).toEqual([["pool-buckhead", null]]);
    await store.transaction((tx) => answerWaitlistOffer(tx, { offerId: offer.id, familyId, answer: "yes", today: TODAY, now: NOW, newId: testId }));
    data = await store.snapshot();
    expect(familyLessons(data, familyId).map((l) => l.enrollment.timeId)).toEqual(["buc-sun-0930-pier"]);
    expect(data.waitlistEntries.filter((w) => w.childRecordId === child.id)).toEqual([]);
  });

  it("a no keeps the child waiting for any time that fits there", async () => {
    const { store, familyId, note } = await julesAsks();
    const own = familyLessons(await store.snapshot(), familyId)[0];
    const offer = await store.transaction((tx) => offerDifferentTime(tx, { noteId: note.id, classId: "buc-sun-0930-pier", inPlaceOfEnrollmentId: own.enrollment.id, today: TODAY, now: NOW, newId: testId }));
    await store.transaction((tx) => answerWaitlistOffer(tx, { offerId: offer.id, familyId, answer: "no", today: TODAY, now: NOW, newId: testId }));
    const data = await store.snapshot();
    expect(familyLessons(data, familyId).map((l) => l.enrollment.timeId)).toEqual(["mad-sun-0930-pier"]);
    expect(waitlistItems(data, TODAY).map((i) => [i.child.firstName, i.wanted])).toEqual([["Jules", null]]);
  });

  it("with nothing open, a person puts the child on the waitlist instead, once", async () => {
    // Mia, in the Sunday 10:00 Shallows class; Buckhead's Wednesday Shallows class fills, so nothing else fits.
    const { store, child, note } = await julesAsks("move", { firstName: "Mia", birth: "2022-07-30", stage: "shallows" as never, timeId: "mad-sun-1000-shallows" });
    expect(differentTimes(await store.snapshot(), child.id, TODAY).map((t) => t.cls.id)).toEqual(["buc-wed-1600-shallows"]);
    await store.transaction((tx) => tx.update("classes", "buc-wed-1600-shallows", { openSpots: 0 }));
    expect(differentTimes(await store.snapshot(), child.id, TODAY)).toEqual([]);
    await store.transaction((tx) => waitForDifferentTime(tx, { noteId: note.id, poolId: "pool-madison", now: NOW, newId: testId }));
    await store.transaction((tx) => waitForDifferentTime(tx, { noteId: note.id, poolId: "pool-madison", now: NOW, newId: testId }));
    const data = await store.snapshot();
    expect(data.waitlistEntries.filter((w) => w.childRecordId === child.id).map((w) => [w.poolId, w.classId])).toEqual([["pool-madison", null]]);
    expect(data.familyNotes.find((n) => n.id === note.id)!.readAt).toBe(NOW);
  });

  it("only for a different-time note", async () => {
    const { store, familyId, note } = await julesAsks("stop");
    const own = familyLessons(await store.snapshot(), familyId)[0];
    await expect(
      store.transaction((tx) => offerDifferentTime(tx, { noteId: note.id, classId: "buc-sun-0930-pier", inPlaceOfEnrollmentId: own.enrollment.id, today: TODAY, now: NOW, newId: testId })),
    ).rejects.toThrow(OfferProblemError);
  });
});

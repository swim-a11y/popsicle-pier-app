import { describe, expect, it } from "vitest";

import { LocalStore } from "@/data/store";
import { signAndSave } from "@/rules/booking";
import { nextLessonPerChild, upcomingLessons } from "@/rules/family";
import { answerFillIn, fillInState, sendFillIn } from "@/rules/fillins";
import { doneItems, inboxCounts } from "@/rules/inbox";
import { markNoteRead, missOptions, sendNote } from "@/rules/notes";
import { OfferProblemError } from "@/rules/offers";
import { answersWaiting } from "@/rules/owed";
import { timesForChild } from "@/rules/times";
import { buildSeed } from "@/sandbox/seed";

import { completeDraft, memoryStorage, NOW, testId, TODAY } from "./helpers";

const flat = (s: string) => s.replace(/\s+/g, " ");

async function missNote(date = "2026-11-08") {
  const store = new LocalStore({ seedVersion: "t", seed: buildSeed, storage: memoryStorage() });
  const draft = completeDraft({});
  await store.transaction((tx) => tx.add("signUpDrafts", draft));
  const { familyId } = await store.transaction((tx) => signAndSave(tx, { draft, today: TODAY, now: NOW, browserName: "Chrome", newId: testId }));
  const data = await store.snapshot();
  const mia = data.children.find((c) => c.familyId === familyId)!;
  const option = missOptions(data, familyId, mia.id, TODAY).find((o) => o.date === date)!;
  const note = await store.transaction((tx) => sendNote(tx, { familyId, childRecordId: mia.id, kind: "miss", enrollmentId: option.enrollmentId, lessonDate: date, today: TODAY, now: NOW, newId: testId }));
  return { store, familyId, mia, note };
}

describe("fill-ins", () => {
  it("a family's own miss can get one fill-in: the same coach, the week after", async () => {
    const { store, note } = await missNote();
    const state = fillInState(await store.snapshot(), note, TODAY);
    if (state?.kind !== "offer") throw new Error(String(state?.kind));
    expect(state.coach).toBe("Dev");
    // Coach Dev's Pier class doesn't fit Mia's stage and her own class is hers: his private times the week after.
    expect(state.slots.map((s) => `${s.kind} ${s.date} ${s.time.startTime} ${s.time.instructorFirstName}`)).toEqual([
      "evaluation 2026-11-15 11:00 Dev",
      "evaluation 2026-11-15 11:30 Dev",
    ]);
    for (const s of state.slots) expect(s.date > "2026-11-08" && s.date <= "2026-11-15").toBe(true);
  });

  it("a person sends it with the app's words; the note is read; the family answers by the day before", async () => {
    const { store, familyId, note } = await missNote();
    const fillIn = await store.transaction((tx) => sendFillIn(tx, { noteId: note.id, timeId: "mad-eval-sun-1100", date: "2026-11-15", today: TODAY, now: NOW, newId: testId }));
    expect(flat(fillIn.offer.words)).toBe(
      "You told us Mia will miss Sunday, November 8. We can offer a fill-in on Sunday, November 15 at 11:00 am with Coach Dev at Madison. It's the one fill-in for this lesson, and it costs nothing extra. Does that work? Please answer by Saturday, November 14. If we don't hear by then, we'll close it.",
    );
    let data = await store.snapshot();
    expect(data.familyNotes.find((n) => n.id === note.id)!.readAt).toBe(NOW);
    expect(inboxCounts(data, TODAY).notes).toBe(0);
    expect(answersWaiting(data, familyId, TODAY)).toEqual([{ kind: "fill-in", id: fillIn.id, childFirstName: "Mia", answerBy: "2026-11-14" }]);
    // One fill-in only: no second one for the same miss.
    await expect(store.transaction((tx) => sendFillIn(tx, { noteId: note.id, timeId: "mad-eval-sun-1130", date: "2026-11-15", today: TODAY, now: NOW, newId: testId }))).rejects.toThrow(OfferProblemError);
    // Its place is held: a new free evaluation at 11:00 starts the week after.
    const ev = timesForChild({ data, poolId: "pool-madison", birthDate: "2022-01-01", stage: "evaluation", today: "2026-11-11" }).evaluations.find((e) => e.id === "mad-eval-sun-1100")!;
    expect(ev.firstLessonDate).toBe("2026-11-22");
    await store.transaction((tx) => answerFillIn(tx, { fillInId: fillIn.id, familyId, answer: "yes", today: TODAY, now: NOW }));
    data = await store.snapshot();
    expect(fillInState(data, note, TODAY)?.kind).toBe("booked");
    expect(flat(doneItems(data, TODAY)[0].line)).toBe("Offered Mia a fill-in on Sunday, November 15 for Sunday, November 8. They said yes.");
    await expect(store.transaction((tx) => answerFillIn(tx, { fillInId: fillIn.id, familyId, answer: "no", today: TODAY, now: NOW }))).rejects.toThrow("This fill-in has closed.");
  });

  it("the missed day isn't the next lesson; a booked fill-in is, when it comes first", async () => {
    const { store, familyId, note } = await missNote("2026-11-01");
    let data = await store.snapshot();
    // Mia will miss November 1, so her next lesson is November 8.
    expect(nextLessonPerChild(data, familyId, TODAY)[0]).toMatchObject({ date: "2026-11-08", startTime: "10:00", fillIn: false });
    const state = fillInState(data, note, TODAY);
    if (state?.kind !== "offer") throw new Error(String(state?.kind));
    const fillIn = await store.transaction((tx) => sendFillIn(tx, { noteId: note.id, timeId: state.slots[0].time.id, date: state.slots[0].date, today: TODAY, now: NOW, newId: testId }));
    await store.transaction((tx) => answerFillIn(tx, { fillInId: fillIn.id, familyId, answer: "yes", today: TODAY, now: NOW }));
    data = await store.snapshot();
    const lessons = upcomingLessons(data, familyId, TODAY);
    expect(lessons.map((l) => [l.date, l.startTime, l.fillIn, l.inPlaceOf])).toEqual([
      ["2026-11-08", "10:00", false, null],
      ["2026-11-08", "11:00", true, "2026-11-01"],
    ]);
  });

  it("a no, or no answer, closes it with nothing more; no opening or a past week means none to offer", async () => {
    const { store, familyId, note } = await missNote();
    const fillIn = await store.transaction((tx) => sendFillIn(tx, { noteId: note.id, timeId: "mad-eval-sun-1100", date: "2026-11-15", today: TODAY, now: NOW, newId: testId }));
    expect(fillInState(await store.snapshot(), note, "2026-11-15")?.kind).toBe("closed");
    await store.transaction((tx) => answerFillIn(tx, { fillInId: fillIn.id, familyId, answer: "no", today: TODAY, now: NOW }));
    expect(fillInState(await store.snapshot(), note, TODAY)?.kind).toBe("closed");

    const other = await missNote("2026-11-22");
    await other.store.transaction((tx) => {
      for (const id of ["mad-eval-sun-1100", "mad-eval-sun-1130"]) tx.update("evaluationTimes", id, { openSpots: 0 });
    });
    expect(fillInState(await other.store.snapshot(), other.note, TODAY)).toEqual({ kind: "no-opening", coach: "Dev" });
    expect(fillInState(await other.store.snapshot(), other.note, "2026-11-28")).toEqual({ kind: "passed" });
  });

  it("a move or stop note has no fill-in, and reading a miss note without one is a person's choice", async () => {
    const { store, familyId, mia, note } = await missNote();
    const move = await store.transaction((tx) => sendNote(tx, { familyId, childRecordId: mia.id, kind: "move", today: TODAY, now: NOW, newId: testId }));
    expect(fillInState(await store.snapshot(), move, TODAY)).toBeNull();
    await store.transaction((tx) => markNoteRead(tx, { noteId: note.id, now: NOW, by: "the school" }));
    expect((await store.snapshot()).fillIns).toEqual([]);
  });
});

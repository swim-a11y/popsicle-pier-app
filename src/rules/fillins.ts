/*
  Fill-ins (the owner's ruling 5, October 30, 2026, building the brief's
  rule): "A family's own miss gets a fill-in only: same instructor, the week
  after." When a family's "We'll miss" note arrives, a person can offer one
  date: the child's own coach at the same pool, in the week after the missed
  lesson, in a class that fits or the coach's private time, with room that
  day. The app drafts the words; the person sends them; the family answers
  yes or no by the day before. One fill-in only: no second date and no
  credit, and the missed lesson stays on the bill.
*/
import type { Transaction } from "@/data/store";
import type { AppData, DateOnly, FamilyNote, FillIn, IsoTime } from "@/data/types";
import { addDays, clockTime, longDate } from "@/rules/dates";
import { lessonInfo } from "@/rules/family";
import { offerOpen } from "@/rules/holds";
import { BY_THE_SCHOOL, OfferProblemError } from "@/rules/offers";
import { coachSlots, type OwedSlot } from "@/rules/owed";

/** "The week after": the seven days after the missed lesson. */
export const FILL_IN_WEEK_DAYS = 7;
/** A date at least two days out, so the family has a day to answer. */
export const FILL_IN_LEAD_DAYS = 2;

export type FillInState =
  | { kind: "offer"; slots: OwedSlot[]; coach: string }
  | { kind: "no-opening"; coach: string }
  | { kind: "passed" }
  | { kind: "waiting"; fillIn: FillIn }
  | { kind: "booked"; fillIn: FillIn }
  | { kind: "closed"; fillIn: FillIn };

export function fillInForNote(data: Readonly<AppData>, noteId: string): FillIn | undefined {
  return data.fillIns.find((f) => f.noteId === noteId);
}

/** The missed class, for a "We'll miss" note about a weekly class. A free evaluation is one visit, so it has no fill-in. */
function missedLesson(data: Readonly<AppData>, note: FamilyNote) {
  if (note.kind !== "miss" || !note.lessonDate || !note.enrollmentId) return null;
  const enrollment = data.enrollments.find((e) => e.id === note.enrollmentId);
  const info = enrollment ? lessonInfo(data, enrollment) : null;
  return info && info.lessonKind !== "evaluation" ? info : null;
}

/** Where a "We'll miss" note's fill-in stands. null: a note that has no fill-in (a move or stop note, or a free evaluation). */
export function fillInState(data: Readonly<AppData>, note: FamilyNote, today: DateOnly): FillInState | null {
  const info = missedLesson(data, note);
  if (!info) return null;
  const fillIn = fillInForNote(data, note.id);
  if (fillIn) {
    if (fillIn.offer.answer === "yes") return { kind: "booked", fillIn };
    if (offerOpen(fillIn.offer, today)) return { kind: "waiting", fillIn };
    return { kind: "closed", fillIn };
  }
  const missed = note.lessonDate!;
  const last = addDays(missed, FILL_IN_WEEK_DAYS);
  let from = addDays(today, FILL_IN_LEAD_DAYS);
  if (addDays(missed, 1) > from) from = addDays(missed, 1);
  if (from > last) return { kind: "passed" };
  const slots = coachSlots(
    data,
    { childRecordId: note.childRecordId, poolId: info.pool.id, instructorFirstName: info.instructorFirstName, from, to: last, offered: new Set() },
    today,
  );
  return slots.length > 0 ? { kind: "offer", slots, coach: info.instructorFirstName } : { kind: "no-opening", coach: info.instructorFirstName };
}

/** The family answers by the day before the fill-in. */
export function fillInAnswerBy(date: DateOnly): DateOnly {
  return addDays(date, -1);
}

/** The words a person reviews before sending. Exactly these are stored and shown to the family. */
export function fillInWords(input: { childFirstName: string; missedDate: DateOnly; slot: OwedSlot; poolName: string; today: DateOnly }): string {
  const { childFirstName: name, missedDate, slot, poolName, today } = input;
  return `You told us ${name} will miss ${longDate(missedDate, today)}. We can offer a fill-in on ${longDate(slot.date, today)} at ${clockTime(slot.time.startTime)} with Coach ${slot.time.instructorFirstName} at ${poolName}. Does that work? Please answer by ${longDate(fillInAnswerBy(slot.date), today)}.`;
}

/** A person sends the one fill-in. Sending it also marks the family's note read. */
export function sendFillIn(
  tx: Transaction,
  input: { noteId: string; timeId: string; date: DateOnly; today: DateOnly; now: IsoTime; newId: () => string; by?: string },
): FillIn {
  const note = tx.get("familyNotes", input.noteId);
  if (!note) throw new OfferProblemError("That note isn't here anymore.");
  const data = tx.data();
  const state = fillInState(data, note, input.today);
  if (!state || state.kind !== "offer") throw new OfferProblemError("This note isn't waiting for a fill-in.");
  const slot = state.slots.find((s) => s.time.id === input.timeId && s.date === input.date);
  if (!slot) throw new OfferProblemError("That date isn't open anymore.");
  const info = missedLesson(data, note)!;
  const child = data.children.find((c) => c.id === note.childRecordId)!;
  const by = input.by ?? BY_THE_SCHOOL;
  const fillIn = tx.add("fillIns", {
    id: input.newId(),
    familyId: note.familyId,
    childRecordId: note.childRecordId,
    enrollmentId: info.enrollment.id,
    missedDate: note.lessonDate!,
    noteId: note.id,
    poolId: info.pool.id,
    instructorFirstName: info.instructorFirstName,
    offer: {
      timeKind: slot.kind,
      timeId: slot.time.id,
      date: slot.date,
      words: fillInWords({ childFirstName: child.firstName, missedDate: note.lessonDate!, slot, poolName: info.pool.name, today: input.today }),
      offeredAt: input.now,
      offeredBy: by,
      answerBy: fillInAnswerBy(slot.date),
      answer: null,
      answeredAt: null,
    },
    createdAt: input.now,
  });
  if (!note.readAt) tx.update("familyNotes", note.id, { readAt: input.now, readBy: by });
  return fillIn;
}

/** The family's answer to the fill-in. */
export function answerFillIn(tx: Transaction, input: { fillInId: string; familyId: string; answer: "yes" | "no"; today: DateOnly; now: IsoTime }): FillIn {
  const fillIn = tx.get("fillIns", input.fillInId);
  if (!fillIn || fillIn.familyId !== input.familyId) throw new OfferProblemError("That fill-in isn't here anymore.");
  if (fillIn.offer.answer !== null || !offerOpen(fillIn.offer, input.today)) throw new OfferProblemError("This fill-in has closed.");
  return tx.update("fillIns", fillIn.id, { offer: { ...fillIn.offer, answer: input.answer, answeredAt: input.now } });
}

/** A family's fill-ins, newest first. */
export function fillInsForFamily(data: Readonly<AppData>, familyId: string): FillIn[] {
  return data.fillIns.filter((f) => f.familyId === familyId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

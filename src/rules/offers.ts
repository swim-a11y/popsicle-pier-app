/*
  Waitlist offers. A person chooses which child gets an open spot, and
  whether it's another class or in place of one the child already has; the
  app only drafts the words. The family answers yes or no. A yes books the
  spot that was offered (and, for a switch, ends the old class); a no keeps
  the child on the waitlist. Nothing here picks a child, pairs partners or
  moves anyone on its own.
*/
import type { Transaction } from "@/data/store";
import type { AppData, Child, DateOnly, Family, IsoTime, Pool, SwimClass, WaitlistEntry, WaitlistOffer } from "@/data/types";
import { lessonPaymentNote } from "@/rules/add";
import { bookTime } from "@/rules/booking";
import { addDays, clockTime, longDate, weekdayName } from "@/rules/dates";
import { familyLessons, hasLessonPayment, isActive, lessonInfo, upcomingLessonDate, type LessonInfo } from "@/rules/family";
import { offerOpen } from "@/rules/holds";
import { timesForChild } from "@/rules/times";

/** A family has a week to answer an offer. */
export const ANSWER_DAYS = 7;
/** Who sends offers and reads notes in this sample. */
export const BY_THE_SCHOOL = "the school";

export class OfferProblemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfferProblemError";
  }
}

/** "the Sunday 9:00 am class" */
export function classWords(cls: Pick<SwimClass, "weekday" | "startTime">): string {
  return `the ${weekdayName(cls.weekday)} ${clockTime(cls.startTime)} class`;
}

export interface WaitlistItem {
  entry: WaitlistEntry;
  family: Family;
  child: Child;
  pool: Pool;
  /** The class waited for, or null for any time that fits at the pool. */
  wanted: SwimClass | null;
  /** Classes that fit the child with a spot free now (only the wanted one, for a class entry). */
  open: { cls: SwimClass; spotsFree: number }[];
  /** The child's own classes, which a person may offer the spot in place of. */
  ownClasses: LessonInfo[];
  /** An offer still waiting for the family's answer. */
  pending: WaitlistOffer | null;
  /** A family with no way to pay for lessons sets that up with a person before an offer. */
  canPay: boolean;
}

/** Everyone on a waitlist, first come first. A person decides who is offered what. */
export function waitlistItems(data: Readonly<AppData>, today: DateOnly): WaitlistItem[] {
  const items: WaitlistItem[] = [];
  for (const entry of [...data.waitlistEntries].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))) {
    const family = data.families.find((f) => f.id === entry.familyId);
    const child = data.children.find((c) => c.id === entry.childRecordId);
    const pool = data.pools.find((p) => p.id === entry.poolId);
    if (!family || !child || !pool) continue;
    const ownClasses = familyLessons(data, family.id).filter((l) => l.child.id === child.id && l.lessonKind !== "evaluation");
    const wanted = entry.classId ? (data.classes.find((c) => c.id === entry.classId) ?? null) : null;
    const fits = timesForChild({ data, poolId: pool.id, birthDate: child.birthDate, stage: child.stageId ?? "evaluation", today }).classes;
    const open = fits
      .filter((o) => !o.full && (!wanted || o.id === wanted.id) && !ownClasses.some((l) => l.enrollment.timeId === o.id))
      .map((o) => ({ cls: data.classes.find((c) => c.id === o.id)!, spotsFree: o.spotsLeft }));
    const pending = data.waitlistOffers.find((o) => o.waitlistEntryId === entry.id && offerOpen(o, today)) ?? null;
    items.push({ entry, family, child, pool, wanted, open, ownClasses, pending, canPay: hasLessonPayment(data, family.id) });
  }
  return items;
}

/** "the Sunday 9:30 am class at Madison, with Coach Dev": a class in full, since both pools have look-alike times. */
export function classFullWords(cls: Pick<SwimClass, "weekday" | "startTime" | "instructorFirstName">, poolName: string): string {
  return `${classWords(cls)} at ${poolName}, with Coach ${cls.instructorFirstName}`;
}

/**
 * The words a person reviews before sending. Exactly these are stored and
 * shown to the family. A switch names both classes in full and says what yes
 * and no do; a reply to the family's "different time" note says so.
 */
export function waitlistOfferWords(input: {
  child: Pick<Child, "firstName">;
  cls: SwimClass;
  pool: Pick<Pool, "name">;
  inPlaceOf: (Pick<LessonInfo, "weekday" | "startTime" | "instructorFirstName"> & { pool: Pick<Pool, "name"> }) | null;
  answerBy: DateOnly;
  today: DateOnly;
  asked?: boolean;
}): string {
  const { child, cls, pool, inPlaceOf, answerBy, today, asked } = input;
  const name = child.firstName;
  const there = classFullWords(cls, pool.name);
  const by = `Please answer by ${longDate(answerBy, today)}.`;
  if (!inPlaceOf) return `A spot opened for ${name} in ${there}. Would you like it? ${by}`;
  const from = classFullWords(inPlaceOf, inPlaceOf.pool.name);
  if (asked) {
    return `You asked about a different time for ${name}. There's a place in ${there}. If you say yes, ${name} moves there from ${from}, and that class ends for ${name}. If you say no, or don't answer, ${name} keeps that class and stays on the ${pool.name} waitlist for a time that fits. ${by}`;
  }
  return `A spot opened for ${name} in ${there}. Would you like ${name} to move there from ${from}? If you say yes, that class ends for ${name}; if you say no, nothing changes. ${by}`;
}

/** A person sends the drafted offer. The spot is held for the family until they answer or the week is up. */
export function sendWaitlistOffer(
  tx: Transaction,
  input: { entryId: string; classId: string; inPlaceOfEnrollmentId: string | null; today: DateOnly; now: IsoTime; newId: () => string; by?: string; fromNoteId?: string },
): WaitlistOffer {
  const item = waitlistItems(tx.data(), input.today).find((i) => i.entry.id === input.entryId);
  if (!item) throw new OfferProblemError("That waitlist entry isn't here anymore.");
  if (item.pending) throw new OfferProblemError("An offer is already waiting for this family's answer.");
  if (!item.canPay) throw new OfferProblemError("This family hasn't set up how they'll pay for lessons yet.");
  const spot = item.open.find((o) => o.cls.id === input.classId);
  if (!spot) throw new OfferProblemError("That spot isn't open anymore.");
  const inPlaceOf = input.inPlaceOfEnrollmentId ? item.ownClasses.find((l) => l.enrollment.id === input.inPlaceOfEnrollmentId) : null;
  if (input.inPlaceOfEnrollmentId && !inPlaceOf) throw new OfferProblemError("That class isn't this child's.");
  const answerBy = addDays(input.today, ANSWER_DAYS);
  return tx.add("waitlistOffers", {
    id: input.newId(),
    waitlistEntryId: item.entry.id,
    familyId: item.family.id,
    childRecordId: item.child.id,
    poolId: item.pool.id,
    classId: spot.cls.id,
    inPlaceOfEnrollmentId: inPlaceOf?.enrollment.id ?? null,
    fromNoteId: input.fromNoteId ?? null,
    words: waitlistOfferWords({ child: item.child, cls: spot.cls, pool: item.pool, inPlaceOf: inPlaceOf ?? null, answerBy, today: input.today, asked: Boolean(input.fromNoteId) }),
    offeredAt: input.now,
    offeredBy: input.by ?? BY_THE_SCHOOL,
    answerBy,
    answer: null,
    answeredAt: null,
    enrollmentId: null,
  });
}

/**
 * Ends one class for a child from today: the enrollment is kept with its end
 * date (so bills keep the lessons already taught, and notes keep their
 * class) and its spot opens. A partner left alone in a semi-private class
 * starts the unpaired month again from their next lesson; their price
 * doesn't change.
 */
export function leaveClass(tx: Transaction, enrollmentId: string, today: DateOnly): void {
  const e = tx.get("enrollments", enrollmentId);
  if (!e || !isActive(e)) return;
  tx.update("enrollments", e.id, { endedOn: today });
  if (e.kind === "evaluation") {
    const ev = tx.get("evaluationTimes", e.timeId);
    if (ev) tx.update("evaluationTimes", ev.id, { openSpots: Math.min(ev.capacity, ev.openSpots + 1) });
    return;
  }
  const cls = tx.get("classes", e.timeId);
  if (!cls) return;
  tx.update("classes", cls.id, { openSpots: Math.min(cls.capacity, cls.openSpots + 1) });
  const lt = tx.get("lessonTypes", cls.lessonTypeId);
  const rest = tx.list("enrollments").filter((x) => x.kind === "class" && x.timeId === cls.id && isActive(x));
  if (lt?.kind === "semi-private" && rest.length === 1) {
    const info = lessonInfo(tx.data(), rest[0]);
    if (info) tx.update("enrollments", rest[0].id, { unpairedSince: upcomingLessonDate(tx.data(), info, today) });
  }
}

/** The family's answer. Yes books the offered spot; no keeps the child on the waitlist. */
export function answerWaitlistOffer(
  tx: Transaction,
  input: { offerId: string; familyId: string; answer: "yes" | "no"; today: DateOnly; now: IsoTime; newId: () => string },
): WaitlistOffer {
  const offer = tx.get("waitlistOffers", input.offerId);
  if (!offer || offer.familyId !== input.familyId) throw new OfferProblemError("That offer isn't here anymore.");
  if (!offerOpen(offer, input.today)) throw new OfferProblemError("This offer has closed.");
  if (input.answer === "no") return tx.update("waitlistOffers", offer.id, { answer: "no", answeredAt: input.now });
  const pool = tx.get("pools", offer.poolId)!;
  if (!hasLessonPayment(tx.data(), offer.familyId)) throw new OfferProblemError(lessonPaymentNote(pool.schoolEmail));
  if (offer.inPlaceOfEnrollmentId) leaveClass(tx, offer.inPlaceOfEnrollmentId, input.today);
  const cls = tx.get("classes", offer.classId)!;
  const enrollment = bookTime(tx, {
    familyId: offer.familyId,
    childRecordId: offer.childRecordId,
    booking: { kind: "class", timeId: cls.id },
    poolId: cls.poolId,
    today: input.today,
    now: input.now,
    newId: input.newId,
    alone: cls.openSpots === cls.capacity,
    offerId: offer.id,
  });
  if (tx.get("waitlistEntries", offer.waitlistEntryId)) tx.remove("waitlistEntries", offer.waitlistEntryId);
  return tx.update("waitlistOffers", offer.id, { answer: "yes", answeredAt: input.now, enrollmentId: enrollment.id });
}

/**
 * The family leaves a waitlist: their own choice, no person needed. Not while
 * an offer for it waits for their answer; they answer that first.
 */
export function leaveWaitlist(tx: Transaction, input: { entryId: string; familyId: string; today: DateOnly }): void {
  const entry = tx.get("waitlistEntries", input.entryId);
  if (!entry || entry.familyId !== input.familyId) throw new OfferProblemError("That waitlist isn't here anymore.");
  if (tx.list("waitlistOffers").some((o) => o.waitlistEntryId === entry.id && offerOpen(o, input.today))) {
    throw new OfferProblemError("The school offered a spot from this waitlist. Please answer it in Messages first.");
  }
  tx.remove("waitlistEntries", entry.id);
}

/** A family's offers, newest first. */
export function offersForFamily(data: Readonly<AppData>, familyId: string): WaitlistOffer[] {
  return data.waitlistOffers.filter((o) => o.familyId === familyId).sort((a, b) => (a.offeredAt < b.offeredAt ? 1 : -1));
}

/** An open time that fits a child, at either pool, for a "different time" note. */
export interface DifferentTime {
  cls: SwimClass;
  pool: Pool;
}

/** Open classes at either pool that fit the child now, other than their own: what a person can offer for a "different time" note. */
export function differentTimes(data: Readonly<AppData>, childRecordId: string, today: DateOnly): DifferentTime[] {
  const child = data.children.find((c) => c.id === childRecordId);
  if (!child) return [];
  const own = familyLessons(data, child.familyId).filter((l) => l.child.id === child.id);
  const out: DifferentTime[] = [];
  for (const pool of data.pools) {
    for (const o of timesForChild({ data, poolId: pool.id, birthDate: child.birthDate, stage: child.stageId ?? "evaluation", today }).classes) {
      if (o.full || own.some((l) => l.enrollment.timeId === o.id)) continue;
      out.push({ cls: data.classes.find((c) => c.id === o.id)!, pool });
    }
  }
  return out;
}

/** The family's "different time" note, if it's that kind and theirs. */
function moveNote(tx: Transaction, noteId: string) {
  const note = tx.get("familyNotes", noteId);
  if (!note || note.kind !== "move") throw new OfferProblemError("That note isn't asking for a different time.");
  return note;
}

/**
 * A person offers a different time in reply to the family's note. The child
 * joins the waitlist for any time that fits at that pool (what the family
 * asked for), and the offer goes out in place of the class the person picks;
 * the note is read. A no keeps the child on that waitlist, which the family
 * can leave from Home.
 */
export function offerDifferentTime(
  tx: Transaction,
  input: { noteId: string; classId: string; inPlaceOfEnrollmentId: string; today: DateOnly; now: IsoTime; newId: () => string; by?: string },
): WaitlistOffer {
  const note = moveNote(tx, input.noteId);
  const cls = tx.get("classes", input.classId);
  if (!cls || !differentTimes(tx.data(), note.childRecordId, input.today).some((t) => t.cls.id === cls.id)) throw new OfferProblemError("That time isn't open anymore.");
  const entry = tx.add("waitlistEntries", { id: input.newId(), familyId: note.familyId, childRecordId: note.childRecordId, poolId: cls.poolId, classId: null, createdAt: input.now });
  const offer = sendWaitlistOffer(tx, { entryId: entry.id, classId: cls.id, inPlaceOfEnrollmentId: input.inPlaceOfEnrollmentId, today: input.today, now: input.now, newId: input.newId, by: input.by, fromNoteId: note.id });
  if (!note.readAt) tx.update("familyNotes", note.id, { readAt: input.now, readBy: input.by ?? BY_THE_SCHOOL });
  return offer;
}

/** Nothing that fits is open: a person puts the child on the waitlist for any time that fits at a pool, and the note is read. */
export function waitForDifferentTime(tx: Transaction, input: { noteId: string; poolId: string; now: IsoTime; newId: () => string; by?: string }): WaitlistEntry {
  const note = moveNote(tx, input.noteId);
  const already = tx.list("waitlistEntries").find((w) => w.childRecordId === note.childRecordId && w.poolId === input.poolId && w.classId === null);
  const entry = already ?? tx.add("waitlistEntries", { id: input.newId(), familyId: note.familyId, childRecordId: note.childRecordId, poolId: input.poolId, classId: null, createdAt: input.now });
  if (!note.readAt) tx.update("familyNotes", note.id, { readAt: input.now, readBy: input.by ?? BY_THE_SCHOOL });
  return entry;
}

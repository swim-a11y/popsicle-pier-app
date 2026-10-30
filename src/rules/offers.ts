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
import { familyLessons, hasLessonPayment, lessonInfo, upcomingLessonDate, type LessonInfo } from "@/rules/family";
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

/** The words a person reviews before sending. Exactly these are stored and shown to the family. */
export function waitlistOfferWords(input: { child: Pick<Child, "firstName">; cls: SwimClass; pool: Pick<Pool, "name">; inPlaceOf: Pick<LessonInfo, "weekday" | "startTime"> | null; answerBy: DateOnly; today: DateOnly }): string {
  const { child, cls, pool, inPlaceOf, answerBy, today } = input;
  const spot = `A spot opened for ${child.firstName} in ${classWords(cls)} at ${pool.name}, with Coach ${cls.instructorFirstName}.`;
  const ask = inPlaceOf ? `Would you like ${child.firstName} to move there from ${classWords(inPlaceOf)}?` : "Would you like it?";
  return `${spot} ${ask} Please answer by ${longDate(answerBy, today)}.`;
}

/** A person sends the drafted offer. The spot is held for the family until they answer or the week is up. */
export function sendWaitlistOffer(
  tx: Transaction,
  input: { entryId: string; classId: string; inPlaceOfEnrollmentId: string | null; today: DateOnly; now: IsoTime; newId: () => string; by?: string },
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
    words: waitlistOfferWords({ child: item.child, cls: spot.cls, pool: item.pool, inPlaceOf: inPlaceOf ?? null, answerBy, today: input.today }),
    offeredAt: input.now,
    offeredBy: input.by ?? BY_THE_SCHOOL,
    answerBy,
    answer: null,
    answeredAt: null,
    enrollmentId: null,
  });
}

/**
 * Ends one class for a child: the enrollment goes and its spot opens. A
 * partner left alone in a semi-private class starts the unpaired month again
 * from their next lesson; their price doesn't change.
 */
export function leaveClass(tx: Transaction, enrollmentId: string, today: DateOnly): void {
  const e = tx.get("enrollments", enrollmentId);
  if (!e) return;
  tx.remove("enrollments", e.id);
  if (e.kind === "evaluation") {
    const ev = tx.get("evaluationTimes", e.timeId);
    if (ev) tx.update("evaluationTimes", ev.id, { openSpots: Math.min(ev.capacity, ev.openSpots + 1) });
    return;
  }
  const cls = tx.get("classes", e.timeId);
  if (!cls) return;
  tx.update("classes", cls.id, { openSpots: Math.min(cls.capacity, cls.openSpots + 1) });
  const lt = tx.get("lessonTypes", cls.lessonTypeId);
  const rest = tx.list("enrollments").filter((x) => x.kind === "class" && x.timeId === cls.id);
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

/** A family's offers, newest first. */
export function offersForFamily(data: Readonly<AppData>, familyId: string): WaitlistOffer[] {
  return data.waitlistOffers.filter((o) => o.familyId === familyId).sort((a, b) => (a.offeredAt < b.offeredAt ? 1 : -1));
}

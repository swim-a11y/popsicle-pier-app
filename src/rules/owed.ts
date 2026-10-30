/*
  Owed lessons. A lesson the school cancels is offered again with the
  child's own instructor within three weeks: one date offered, a week to
  answer, one more date, then it closes with no credit. A credit only when
  no opening exists, and only with the owner's approval. A person picks
  each date (a class that fits, or one of the coach's private free
  evaluation times) and sends the words the app drafts; nothing is booked
  until the family says yes. Closed days are different: never billed,
  never owed.
*/
import type { Transaction } from "@/data/store";
import type { AppData, DateOnly, EvaluationTime, IsoTime, OwedLesson, OwedOffer, Pool, SwimClass } from "@/data/types";
import { cancellationOn, closureOn } from "@/rules/closures";
import { addDays, ageInMonths, clockTime, longDate, minutesOfDay, weekdayOf } from "@/rules/dates";
import { heldByWaitlistOffers, offerOpen, oneOffsOn } from "@/rules/holds";
import { ANSWER_DAYS, BY_THE_SCHOOL, OfferProblemError, offersForFamily } from "@/rules/offers";
import { classFits } from "@/rules/times";

export const OWED_WINDOW_DAYS = 21;
export const MAX_OWED_OFFERS = 2;

/** A class, or a private (free evaluation) time, of the child's own coach on one date. */
export interface OwedSlot {
  kind: "class" | "evaluation";
  time: SwimClass | EvaluationTime;
  date: DateOnly;
}

/**
 * Dates a person can offer: the child's own coach at the same pool, from
 * tomorrow to three weeks after the cancelled lesson, in a class that fits
 * the child or one of the coach's private (free evaluation) times, with a
 * place free that day. Never a closed or cancelled day, the child's own
 * class, a date already offered, or a time that runs into one of the
 * child's lessons.
 */
export function owedSlots(data: Readonly<AppData>, owed: OwedLesson, today: DateOnly): OwedSlot[] {
  const child = data.children.find((c) => c.id === owed.childRecordId);
  const pool = data.pools.find((p) => p.id === owed.poolId);
  if (!child || !pool) return [];
  const own = data.enrollments
    .filter((e) => e.childRecordId === child.id && e.kind === "class")
    .map((e) => data.classes.find((c) => c.id === e.timeId))
    .filter((c): c is SwimClass => Boolean(c));
  const offered = new Set(owed.offers.map((o) => `${o.timeId}|${o.date}`));
  const last = addDays(owed.cancelledDate, OWED_WINDOW_DAYS);
  let from = addDays(today, 1);
  if (pool.opensOn && pool.opensOn > from) from = pool.opensOn;
  const times: { kind: OwedSlot["kind"]; time: SwimClass | EvaluationTime }[] = [
    ...data.classes.map((time) => ({ kind: "class" as const, time })),
    ...data.evaluationTimes.map((time) => ({ kind: "evaluation" as const, time })),
  ];
  const slots: OwedSlot[] = [];
  for (const { kind, time } of times) {
    if (time.poolId !== pool.id || time.instructorFirstName !== owed.instructorFirstName) continue;
    if (own.some((c) => c.id === time.id)) continue;
    if (own.some((c) => c.weekday === time.weekday && Math.abs(minutesOfDay(c.startTime) - minutesOfDay(time.startTime)) < 30)) continue;
    const lt = kind === "class" ? data.lessonTypes.find((l) => l.id === (time as SwimClass).lessonTypeId) : undefined;
    if (kind === "class" && !lt) continue;
    for (let d = addDays(from, (time.weekday - weekdayOf(from) + 7) % 7); d <= last; d = addDays(d, 7)) {
      // Never the cancelled day itself: the coach may be away all day.
      if (d === owed.cancelledDate || closureOn(data, pool.id, d) || cancellationOn(data, time.id, d) || offered.has(`${time.id}|${d}`)) continue;
      const age = ageInMonths(child.birthDate, d);
      if (lt ? !classFits(time as SwimClass, lt, age, child.stageId, pool) : age < pool.youngestAgeMonths) continue;
      const held = kind === "class" ? heldByWaitlistOffers(data, time.id, today) : 0;
      if (time.openSpots - held - oneOffsOn(data, time.id, d, today, owed.id) < 1) continue;
      slots.push({ kind, time, date: d });
    }
  }
  return slots.sort((a, b) => (a.date === b.date ? minutesOfDay(a.time.startTime) - minutesOfDay(b.time.startTime) : a.date < b.date ? -1 : 1));
}

export type OwedState =
  | { kind: "offer"; round: number; slots: OwedSlot[] }
  | { kind: "no-opening"; round: number }
  | { kind: "waiting"; offer: OwedOffer }
  | { kind: "booked"; offer: OwedOffer }
  | { kind: "closed"; offer: OwedOffer }
  | { kind: "credited" };

/** Where an owed lesson stands. An offer nobody answered by its day counts as a no. */
export function owedState(data: Readonly<AppData>, owed: OwedLesson, today: DateOnly): OwedState {
  if (owed.creditApprovedAt) return { kind: "credited" };
  const yes = owed.offers.find((o) => o.answer === "yes");
  if (yes) return { kind: "booked", offer: yes };
  const last = owed.offers[owed.offers.length - 1];
  if (last && offerOpen(last, today)) return { kind: "waiting", offer: last };
  if (last && owed.offers.length >= MAX_OWED_OFFERS) return { kind: "closed", offer: last };
  const round = owed.offers.length + 1;
  const slots = owedSlots(data, owed, today);
  return slots.length > 0 ? { kind: "offer", round, slots } : { kind: "no-opening", round };
}

/** A week to answer, and always before the date offered. */
export function owedAnswerBy(date: DateOnly, today: DateOnly): DateOnly {
  const week = addDays(today, ANSWER_DAYS);
  const dayBefore = addDays(date, -1);
  return week < dayBefore ? week : dayBefore;
}

/** The words a person reviews before sending. Exactly these are stored and shown to the family. */
export function owedOfferWords(input: { childFirstName: string; owed: Pick<OwedLesson, "cancelledDate">; slot: OwedSlot; pool: Pick<Pool, "name">; round: number; today: DateOnly }): string {
  const { childFirstName: name, owed, slot, pool, round, today } = input;
  const when = `${longDate(slot.date, today)} at ${clockTime(slot.time.startTime)} with Coach ${slot.time.instructorFirstName} at ${pool.name}`;
  const ask = `Does that work? Please answer by ${longDate(owedAnswerBy(slot.date, today), today)}.`;
  if (round === 1) return `We cancelled ${name}'s lesson on ${longDate(owed.cancelledDate, today)}. We can offer ${when} instead. ${ask}`;
  return `One more date for ${name}'s lesson we cancelled on ${longDate(owed.cancelledDate, today)}: ${when}. ${ask}`;
}

/** A person sends one date. Only a date the rules allow, one at a time, two at most. */
export function sendOwedOffer(
  tx: Transaction,
  input: { owedId: string; timeId: string; date: DateOnly; today: DateOnly; now: IsoTime; by?: string },
): OwedOffer {
  const owed = tx.get("owedLessons", input.owedId);
  if (!owed) throw new OfferProblemError("That owed lesson isn't here anymore.");
  const data = tx.data();
  const state = owedState(data, owed, input.today);
  if (state.kind !== "offer") throw new OfferProblemError("This owed lesson isn't waiting for a date.");
  const slot = state.slots.find((s) => s.time.id === input.timeId && s.date === input.date);
  if (!slot) throw new OfferProblemError("That date isn't open anymore.");
  const child = data.children.find((c) => c.id === owed.childRecordId)!;
  const pool = data.pools.find((p) => p.id === owed.poolId)!;
  const offer: OwedOffer = {
    timeKind: slot.kind,
    timeId: slot.time.id,
    date: slot.date,
    words: owedOfferWords({ childFirstName: child.firstName, owed, slot, pool, round: state.round, today: input.today }),
    offeredAt: input.now,
    offeredBy: input.by ?? BY_THE_SCHOOL,
    answerBy: owedAnswerBy(slot.date, input.today),
    answer: null,
    answeredAt: null,
  };
  tx.update("owedLessons", owed.id, { offers: [...owed.offers, offer] });
  return offer;
}

/** The family's answer to the date offered. */
export function answerOwedOffer(tx: Transaction, input: { owedId: string; familyId: string; answer: "yes" | "no"; today: DateOnly; now: IsoTime }): OwedLesson {
  const owed = tx.get("owedLessons", input.owedId);
  if (!owed || owed.familyId !== input.familyId) throw new OfferProblemError("That offer isn't here anymore.");
  const state = owedState(tx.data(), owed, input.today);
  if (state.kind !== "waiting") throw new OfferProblemError("This offer has closed.");
  const offers = owed.offers.map((o, i) => (i === owed.offers.length - 1 ? { ...o, answer: input.answer, answeredAt: input.now } : o));
  return tx.update("owedLessons", owed.id, { offers });
}

/** Only the owner, and only when no opening exists: that lesson comes off the bill. */
export function approveOwedCredit(tx: Transaction, input: { owedId: string; today: DateOnly; now: IsoTime }): OwedLesson {
  const owed = tx.get("owedLessons", input.owedId);
  if (!owed) throw new OfferProblemError("That owed lesson isn't here anymore.");
  if (owedState(tx.data(), owed, input.today).kind !== "no-opening") throw new OfferProblemError("A credit is only for when no opening exists.");
  return tx.update("owedLessons", owed.id, { creditApprovedAt: input.now });
}

/**
 * A person cancels one class date (the sandbox stands in for them). Each
 * child booked in that class on that date is owed the lesson. Cancelling
 * the same date again adds nothing.
 */
export function cancelClassDate(tx: Transaction, input: { classId: string; date: DateOnly; reason: string; now: IsoTime; newId: () => string }): OwedLesson[] {
  const cls = tx.get("classes", input.classId);
  if (!cls || weekdayOf(input.date) !== cls.weekday || cancellationOn(tx.data(), cls.id, input.date)) return [];
  const cancellation = tx.add("cancellations", { id: input.newId(), classId: cls.id, poolId: cls.poolId, date: input.date, reason: input.reason, createdAt: input.now });
  const owed: OwedLesson[] = [];
  for (const e of tx.list("enrollments").filter((x) => x.kind === "class" && x.timeId === cls.id && x.firstLessonDate <= input.date)) {
    owed.push(
      tx.add("owedLessons", {
        id: input.newId(),
        familyId: e.familyId,
        childRecordId: e.childRecordId,
        enrollmentId: e.id,
        cancellationId: cancellation.id,
        poolId: cls.poolId,
        cancelledDate: input.date,
        instructorFirstName: cls.instructorFirstName,
        offers: [],
        creditApprovedAt: null,
        createdAt: input.now,
      }),
    );
  }
  return owed;
}

/** A family's owed lessons, newest first. */
export function owedForFamily(data: Readonly<AppData>, familyId: string): OwedLesson[] {
  return data.owedLessons.filter((o) => o.familyId === familyId).sort((a, b) => (a.createdAt === b.createdAt ? (a.cancelledDate < b.cancelledDate ? 1 : -1) : a.createdAt < b.createdAt ? 1 : -1));
}

/** Dates a child is booked in place of a cancelled lesson, soonest first. */
export function bookedOwedDates(data: Readonly<AppData>, childRecordId: string): { owed: OwedLesson; offer: OwedOffer; time: SwimClass | EvaluationTime }[] {
  const out: { owed: OwedLesson; offer: OwedOffer; time: SwimClass | EvaluationTime }[] = [];
  for (const owed of data.owedLessons.filter((o) => o.childRecordId === childRecordId)) {
    for (const offer of owed.offers.filter((o) => o.answer === "yes")) {
      const time = offer.timeKind === "class" ? data.classes.find((c) => c.id === offer.timeId) : data.evaluationTimes.find((e) => e.id === offer.timeId);
      if (time) out.push({ owed, offer, time });
    }
  }
  return out.sort((a, b) => (a.offer.date < b.offer.date ? -1 : 1));
}

export interface AnswerWaiting {
  kind: "waitlist" | "owed";
  id: string;
  childFirstName: string;
  answerBy: DateOnly;
}

/** Offers waiting for this family's answer: a waitlist spot or a date for a cancelled lesson. Soonest answer-by first. */
export function answersWaiting(data: Readonly<AppData>, familyId: string, today: DateOnly): AnswerWaiting[] {
  const name = (id: string) => data.children.find((c) => c.id === id)?.firstName ?? "";
  const out: AnswerWaiting[] = [];
  for (const o of offersForFamily(data, familyId)) if (offerOpen(o, today)) out.push({ kind: "waitlist", id: o.id, childFirstName: name(o.childRecordId), answerBy: o.answerBy });
  for (const owed of owedForFamily(data, familyId)) {
    const state = owedState(data, owed, today);
    if (state.kind === "waiting") out.push({ kind: "owed", id: owed.id, childFirstName: name(owed.childRecordId), answerBy: state.offer.answerBy });
  }
  return out.sort((a, b) => (a.answerBy < b.answerBy ? -1 : 1));
}

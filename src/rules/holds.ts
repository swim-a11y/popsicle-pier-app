/*
  Spots a person's offer holds while a family answers. A waitlist offer
  holds a weekly spot in its class; a date offered for an owed lesson or a
  fill-in holds a place on that one date. An offer stays open until it's
  answered or its answer-by day has passed. Imports only the records, so the
  times list, booking and the offers can all read it.
*/
import type { AppData, DateOnly, OwedOffer, WaitlistOffer } from "@/data/types";

export function offerOpen(offer: Pick<WaitlistOffer | OwedOffer, "answer" | "answerBy">, today: DateOnly): boolean {
  return offer.answer === null && today <= offer.answerBy;
}

/** Weekly spots in a class held by open waitlist offers. */
export function heldByWaitlistOffers(data: Readonly<AppData>, classId: string, today: DateOnly, exceptOfferId?: string): number {
  return data.waitlistOffers.filter((o) => o.classId === classId && o.id !== exceptOfferId && offerOpen(o, today)).length;
}

/**
 * Every date offered somewhere else for one lesson: owed lessons' dates and
 * fill-ins. A fill-in goes with the class it stood in for, and one on a day
 * the school cancelled or closed holds nothing.
 */
function oneOffOffers(data: Readonly<AppData>, exceptId?: string): OwedOffer[] {
  const live = (enrollmentId: string) => data.enrollments.some((e) => e.id === enrollmentId && !e.endedOn);
  const dead = (o: OwedOffer) => {
    const poolId = (o.timeKind === "class" ? data.classes.find((c) => c.id === o.timeId) : data.evaluationTimes.find((e) => e.id === o.timeId))?.poolId;
    return data.closures.some((c) => c.poolId === poolId && c.date === o.date) || (o.timeKind === "class" && data.cancellations.some((c) => c.classId === o.timeId && c.date === o.date));
  };
  return [...data.owedLessons.filter((o) => o.id !== exceptId).flatMap((o) => o.offers), ...data.fillIns.filter((f) => f.id !== exceptId && live(f.enrollmentId)).map((f) => f.offer)].filter(
    (o) => !dead(o),
  );
}

/** Places on one date of a class or evaluation time taken by owed lessons and fill-ins: booked there, or offered and still open. */
export function oneOffsOn(data: Readonly<AppData>, timeId: string, date: DateOnly, today: DateOnly, exceptId?: string): number {
  return oneOffOffers(data, exceptId).filter((o) => o.timeId === timeId && o.date === date && (o.answer === "yes" || offerOpen(o, today))).length;
}

/** Dates a new booking can't start on, because owed lessons and fill-ins fill that time's open spots that day. */
export function datesFullOfOneOffs(data: Readonly<AppData>, time: { id: string; openSpots: number }, today: DateOnly): DateOnly[] {
  const dates = new Set(oneOffOffers(data).filter((x) => x.timeId === time.id).map((x) => x.date));
  return [...dates].filter((d) => time.openSpots - oneOffsOn(data, time.id, d, today) < 1);
}

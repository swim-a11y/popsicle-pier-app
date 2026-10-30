/*
  Spots a person's offer holds while a family answers. A waitlist offer
  holds a weekly spot in its class; a date offered for an owed lesson holds
  a place on that one date. An offer stays open until it's answered or its
  answer-by day has passed. Imports only the records, so the times list,
  booking and the offers can all read it.
*/
import type { AppData, DateOnly, OwedOffer, WaitlistOffer } from "@/data/types";

export function offerOpen(offer: Pick<WaitlistOffer | OwedOffer, "answer" | "answerBy">, today: DateOnly): boolean {
  return offer.answer === null && today <= offer.answerBy;
}

/** Weekly spots in a class held by open waitlist offers. */
export function heldByWaitlistOffers(data: Readonly<AppData>, classId: string, today: DateOnly, exceptOfferId?: string): number {
  return data.waitlistOffers.filter((o) => o.classId === classId && o.id !== exceptOfferId && offerOpen(o, today)).length;
}

/** Places on one date of a class or evaluation time taken by owed lessons: booked there, or offered and still open. */
export function oneOffsOn(data: Readonly<AppData>, timeId: string, date: DateOnly, today: DateOnly, exceptOwedId?: string): number {
  let n = 0;
  for (const owed of data.owedLessons) {
    if (owed.id === exceptOwedId) continue;
    for (const offer of owed.offers) {
      if (offer.timeId === timeId && offer.date === date && (offer.answer === "yes" || offerOpen(offer, today))) n += 1;
    }
  }
  return n;
}

/** Dates a new booking can't start on, because owed lessons fill that time's open spots that day. */
export function datesFullOfOneOffs(data: Readonly<AppData>, time: { id: string; openSpots: number }, today: DateOnly): DateOnly[] {
  const dates = new Set(data.owedLessons.flatMap((o) => o.offers.filter((x) => x.timeId === time.id).map((x) => x.date)));
  return [...dates].filter((d) => time.openSpots - oneOffsOn(data, time.id, d, today) < 1);
}

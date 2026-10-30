/*
  The approvals inbox (the owner's ruling, October 30, 2026): one page where
  a person approves each item. It lists what's waiting and drafts the
  words; a person makes every choice, and nothing is sent or booked until
  they do. Staff-facing: it may show child IDs and which question had the
  yes, never details, because there are none to show.
*/
import type { Transaction } from "@/data/store";
import type { AppData, Child, DateOnly, Family, FamilyNote, IsoTime, OwedLesson, TalkRecord } from "@/data/types";
import { longDate, shownAtSchool } from "@/rules/dates";
import { nextLessonPerChild } from "@/rules/family";
import { hasHadFirstLesson } from "@/rules/first-sunday";
import { BY_THE_SCHOOL, OfferProblemError, classWords, waitlistItems } from "@/rules/offers";
import { owedState, type OwedState } from "@/rules/owed";

export interface TalkItem {
  child: Child;
  family: Family;
  /** Which question had the yes. */
  custody: boolean;
  health: boolean;
  /** The lesson that waits until a person has talked with the family. */
  next: { date: DateOnly; poolName: string } | null;
  /** A lesson already marked held (a yes added after the first lesson). */
  hadFirst: boolean;
}

/** The child's newest yes or no answers: from the signature that named them, or the coverage row when they were added. */
export function flagAnswers(data: Readonly<AppData>, childRecordId: string): { custody: boolean; health: boolean } {
  const signed = data.releaseSignatures
    .filter((s) => s.children.some((c) => c.childRecordId === childRecordId))
    .map((s) => ({ at: s.signedAt, answers: s.children.find((c) => c.childRecordId === childRecordId)! }));
  const covered = data.coverages.filter((c) => c.childRecordId === childRecordId && c.answers).map((c) => ({ at: c.addedAt, answers: c.answers! }));
  const newest = [...signed, ...covered].sort((a, b) => (a.at < b.at ? 1 : -1))[0];
  return { custody: Boolean(newest?.answers.custodyYes), health: Boolean(newest?.answers.healthYes) };
}

/** Children whose custody or health yes is waiting for a person to talk with the family. */
export function talkItems(data: Readonly<AppData>, today: DateOnly): TalkItem[] {
  return data.children
    .filter((c) => c.flaggedForPerson)
    .map((child) => {
      const family = data.families.find((f) => f.id === child.familyId)!;
      const next = family ? nextLessonPerChild(data, family.id, today).find((l) => l.child.id === child.id) : undefined;
      return { child, family, ...flagAnswers(data, child.id), next: next ? { date: next.date, poolName: next.pool.name } : null, hadFirst: hasHadFirstLesson(data, child.id) };
    })
    .filter((t) => Boolean(t.family))
    .sort((a, b) => ((a.next?.date ?? "9") < (b.next?.date ?? "9") ? -1 : 1));
}

/** A person talked with the family. The flag clears, and the record of the talk stays. */
export function recordTalk(tx: Transaction, input: { childRecordId: string; now: IsoTime; newId: () => string; by?: string }): TalkRecord {
  const child = tx.get("children", input.childRecordId);
  if (!child || !child.flaggedForPerson) throw new OfferProblemError("That child isn't waiting for a talk.");
  tx.update("children", child.id, { flaggedForPerson: false });
  return tx.add("talkRecords", { id: input.newId(), familyId: child.familyId, childRecordId: child.id, talkedAt: input.now, talkedBy: input.by ?? BY_THE_SCHOOL });
}

export function unreadNotes(data: Readonly<AppData>): FamilyNote[] {
  return data.familyNotes.filter((n) => !n.readAt).sort((a, b) => (a.sentAt < b.sentAt ? -1 : 1));
}

/** Owed lessons a person still has to act on: a date to offer, or a credit to decide. */
export function owedToDo(data: Readonly<AppData>, today: DateOnly): { owed: OwedLesson; state: OwedState }[] {
  return data.owedLessons
    .map((owed) => ({ owed, state: owedState(data, owed, today) }))
    .filter((x) => x.state.kind === "offer" || x.state.kind === "no-opening" || x.state.kind === "waiting")
    .sort((a, b) => (a.owed.cancelledDate < b.owed.cancelledDate ? -1 : 1));
}

export interface InboxCounts {
  talks: number;
  owed: number;
  waitlist: number;
  notes: number;
}

/** How many items wait for a person in each section (an offer waiting for a family's answer isn't counted). */
export function inboxCounts(data: Readonly<AppData>, today: DateOnly): InboxCounts {
  return {
    talks: talkItems(data, today).length,
    owed: owedToDo(data, today).filter((x) => x.state.kind !== "waiting").length,
    waitlist: waitlistItems(data, today).filter((i) => !i.pending && i.open.length > 0).length,
    notes: unreadNotes(data).length,
  };
}

export interface DoneItem {
  at: IsoTime;
  line: string;
}

/** What people did, newest first: talks, notes read, offers sent and how families answered. */
export function doneItems(data: Readonly<AppData>, today: DateOnly, limit = 8): DoneItem[] {
  const name = (childRecordId: string) => data.children.find((c) => c.id === childRecordId)?.firstName ?? "a child";
  const family = (familyId: string) => data.families.find((f) => f.id === familyId)?.parentFullName ?? "a family";
  const items: DoneItem[] = [];
  for (const t of data.talkRecords) items.push({ at: t.talkedAt, line: `Talked with ${family(t.familyId)} about ${name(t.childRecordId)}, ${shownAtSchool(t.talkedAt)}.` });
  for (const n of data.familyNotes) if (n.readAt) items.push({ at: n.readAt, line: `Read: "${n.words}" (${family(n.familyId)})` });
  for (const o of data.waitlistOffers) {
    const cls = data.classes.find((c) => c.id === o.classId);
    const what = cls ? classWords(cls) : "a class";
    const answer = o.answer === "yes" ? "They said yes." : o.answer === "no" ? "They said no, thanks." : o.answerBy < today ? "No answer in time." : `Waiting for an answer by ${longDate(o.answerBy, today)}.`;
    items.push({ at: o.answeredAt ?? o.offeredAt, line: `Offered ${name(o.childRecordId)} ${what}. ${answer}` });
  }
  for (const owed of data.owedLessons) {
    const state = owedState(data, owed, today);
    for (const o of owed.offers) {
      const answer = o.answer === "yes" ? "They said yes." : o.answer === "no" ? "They said no, thanks." : o.answerBy < today ? "No answer in time." : `Waiting for an answer by ${longDate(o.answerBy, today)}.`;
      items.push({ at: o.answeredAt ?? o.offeredAt, line: `Offered ${name(owed.childRecordId)} ${longDate(o.date, today)} for ${longDate(owed.cancelledDate, today)}. ${answer}` });
    }
    if (state.kind === "credited") items.push({ at: owed.creditApprovedAt!, line: `Approved a credit for ${name(owed.childRecordId)}'s lesson on ${longDate(owed.cancelledDate, today)}.` });
    if (state.kind === "closed") items.push({ at: state.offer.answeredAt ?? state.offer.offeredAt, line: `Closed with no credit: ${name(owed.childRecordId)}'s lesson on ${longDate(owed.cancelledDate, today)}.` });
  }
  for (const f of data.fillIns) {
    const o = f.offer;
    const answer = o.answer === "yes" ? "They said yes." : o.answer === "no" ? "They said no, thanks." : o.answerBy < today ? "No answer in time." : `Waiting for an answer by ${longDate(o.answerBy, today)}.`;
    items.push({ at: o.answeredAt ?? o.offeredAt, line: `Offered ${name(f.childRecordId)} a fill-in on ${longDate(o.date, today)} for ${longDate(f.missedDate, today)}. ${answer}` });
  }
  return items.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, limit);
}

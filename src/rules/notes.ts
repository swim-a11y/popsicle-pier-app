/*
  Tap-to-send notes (the owner's ruling, October 30, 2026): ready-made
  notes picked from a child's lesson dates, like "We'll miss Sunday,
  November 8". No free text, so no health details. A person reads each
  one; nothing answers automatically. The words a family sees before
  sending are the words stored.
*/
import type { Transaction } from "@/data/store";
import type { AppData, DateOnly, FamilyNote, IsoTime } from "@/data/types";
import { longDate } from "@/rules/dates";
import { familyLessons, lessonDaysAhead } from "@/rules/family";

export type NoteKind = FamilyNote["kind"];

export const NOTE_WEEKS = 6;

/** The three notes a family can send, in the order Messages lists them. */
export const NOTE_CHOICES: readonly { kind: NoteKind; title: string; line: string }[] = [
  { kind: "miss", title: "We'll miss a lesson", line: "Pick the swimmer and the date." },
  { kind: "move", title: "We'd like a different time", line: "A person talks with you about the times that fit." },
  { kind: "stop", title: "We'd like to stop lessons", line: "A person talks with you before anything changes." },
];

export function noteWords(kind: NoteKind, childFirstName: string, lessonDate: DateOnly | null, today?: DateOnly): string {
  if (kind === "miss") return `We'll miss ${childFirstName}'s lesson on ${longDate(lessonDate!, today)}.`;
  if (kind === "move") return `We'd like to talk about a different lesson time for ${childFirstName}.`;
  return `We'd like to talk about stopping ${childFirstName}'s lessons.`;
}

export interface MissOption {
  date: DateOnly;
  enrollmentId: string;
  startTime: string;
  poolName: string;
}

/** Lesson dates a family can say they'll miss: the weeks ahead, not closed or cancelled, not already in a note. */
export function missOptions(data: Readonly<AppData>, familyId: string, childRecordId: string, today: DateOnly): MissOption[] {
  const noted = new Set(data.familyNotes.filter((n) => n.kind === "miss" && n.childRecordId === childRecordId).map((n) => `${n.enrollmentId}|${n.lessonDate}`));
  const out: MissOption[] = [];
  for (const l of familyLessons(data, familyId).filter((x) => x.child.id === childRecordId)) {
    for (const d of lessonDaysAhead(data, l, today, NOTE_WEEKS)) {
      if (d.closedReason || d.cancelledReason || noted.has(`${l.enrollment.id}|${d.date}`)) continue;
      out.push({ date: d.date, enrollmentId: l.enrollment.id, startTime: l.startTime, poolName: l.pool.name });
    }
  }
  return out.sort((a, b) => (a.date === b.date ? (a.startTime < b.startTime ? -1 : 1) : a.date < b.date ? -1 : 1));
}

export class NoteProblemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoteProblemError";
  }
}

/**
 * Saves a note with the app's own words. A miss is one note per lesson date;
 * a move or stop note is one per swimmer until a person has read it, so a
 * second tap sends nothing new.
 */
export function sendNote(
  tx: Transaction,
  input: { familyId: string; childRecordId: string; kind: NoteKind; enrollmentId?: string | null; lessonDate?: DateOnly | null; today: DateOnly; now: IsoTime; newId: () => string },
): FamilyNote {
  const child = tx.get("children", input.childRecordId);
  if (!child || child.familyId !== input.familyId) throw new NoteProblemError("Pick one of your swimmers.");
  const lessonDate = input.kind === "miss" ? (input.lessonDate ?? null) : null;
  const enrollmentId = input.kind === "miss" ? (input.enrollmentId ?? null) : null;
  if (input.kind === "miss") {
    const fits = missOptions(tx.data(), input.familyId, child.id, input.today).some((o) => o.date === lessonDate && o.enrollmentId === enrollmentId);
    if (!fits) throw new NoteProblemError("Pick one of the lesson dates.");
  } else {
    const open = tx.list("familyNotes").find((n) => n.childRecordId === child.id && n.kind === input.kind && !n.readAt);
    if (open) return open;
  }
  return tx.add("familyNotes", {
    id: input.newId(),
    familyId: input.familyId,
    childRecordId: child.id,
    kind: input.kind,
    lessonDate,
    enrollmentId,
    words: noteWords(input.kind, child.firstName, lessonDate, input.today),
    sentAt: input.now,
    readAt: null,
    readBy: null,
  });
}

/** A person read the note. Nothing answers automatically. */
export function markNoteRead(tx: Transaction, input: { noteId: string; now: IsoTime; by: string }): FamilyNote {
  const note = tx.get("familyNotes", input.noteId);
  if (!note) throw new NoteProblemError("That note isn't here anymore.");
  if (note.readAt) return note;
  return tx.update("familyNotes", note.id, { readAt: input.now, readBy: input.by });
}

/** A family's own notes, newest first. */
export function notesForFamily(data: Readonly<AppData>, familyId: string): FamilyNote[] {
  return data.familyNotes.filter((n) => n.familyId === familyId).sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));
}

/** The family said they'll miss this lesson. */
export function missNoted(data: Readonly<AppData>, enrollmentId: string, date: DateOnly): boolean {
  return data.familyNotes.some((n) => n.kind === "miss" && n.enrollmentId === enrollmentId && n.lessonDate === date);
}

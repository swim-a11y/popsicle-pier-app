/*
  Adding a brother or sister, or another class for a child. The family
  picks a listed time; a person still makes every waitlist offer and
  partner choice. A family on the current release signs nothing: a new
  child gets a coverage row with their own yes or no answers, never an
  edit. A family on an older release signs the current one once for
  everyone. One transaction adds it all, or nothing.
*/
import { evaluationAsksForCard } from "@/config";
import { consentWords } from "@/content/release";
import type { Transaction } from "@/data/store";
import { ANY_TIME, type AddDraft, type AppData, type Child, type DateOnly, type Enrollment, type IsoTime, type StageId } from "@/data/types";
import { AlreadySavedError, bookTime, recordSignature, releaseProblem } from "@/rules/booking";
import { minutesOfDay } from "@/rules/dates";
import { familyChildren, familyLessons, familyPayment, hasLessonPayment } from "@/rules/family";
import { addChildCoverage, currentRelease, familyNeedsToSign } from "@/rules/release";
import { draftBirthDate, emptyDraftChild, nameProblem } from "@/rules/sign-up";
import { timesForChild, type ChildTimes, type TimeOption } from "@/rules/times";

export type AddStepKey = "child" | "stage" | "times" | "questions" | "review";

export const ADD_PATH: Record<AddStepKey, string> = {
  child: "/family/add/child",
  stage: "/family/add/stage",
  times: "/family/add/times",
  questions: "/family/add/questions",
  review: "/family/add/review",
};

export function addDraftId(familyId: string): string {
  return `add:${familyId}`;
}

/** A brother or sister: five steps. Another class: pick the time, then check and add. */
export function addSteps(draft: Pick<AddDraft, "mode">): AddStepKey[] {
  return draft.mode === "child" ? ["child", "stage", "times", "questions", "review"] : ["times", "review"];
}

export function newAddDraft(input: { familyId: string; mode: AddDraft["mode"]; childRecordId: string | null; poolId: string; kidKey: string; now: IsoTime }): AddDraft {
  return {
    id: addDraftId(input.familyId),
    familyId: input.familyId,
    mode: input.mode,
    childRecordId: input.childRecordId,
    poolId: input.poolId,
    kid: emptyDraftChild(input.kidKey),
    answers: { custody: null, health: null, research: false, marketing: false, underwater: false },
    release: null,
    lastPath: input.mode === "child" ? ADD_PATH.child : ADD_PATH.times,
    updatedAt: input.now,
  };
}

/** Who the times are for: the new child, or the child getting another class. */
export function addSubject(
  data: Readonly<AppData>,
  draft: AddDraft,
): { firstName: string; birthDate: DateOnly | null; stage: StageId | "evaluation" | null; childRecordId: string | null } {
  if (draft.mode === "child") return { firstName: draft.kid.firstName.trim(), birthDate: draftBirthDate(draft.kid), stage: draft.kid.stage, childRecordId: null };
  const child = data.children.find((c) => c.id === draft.childRecordId && c.familyId === draft.familyId);
  return { firstName: child?.firstName ?? "", birthDate: child?.birthDate ?? null, stage: child ? (child.stageId ?? "evaluation") : null, childRecordId: child?.id ?? null };
}

/**
 * Times that fit, marked next to a brother's or sister's lesson. Another
 * class never offers the class the child already has, or a time that runs
 * into one of their own lessons, at either pool.
 */
export function addTimes(data: Readonly<AppData>, draft: AddDraft, today: DateOnly): ChildTimes | null {
  const who = addSubject(data, draft);
  if (!who.birthDate || !who.stage) return null;
  const lessons = familyLessons(data, draft.familyId);
  const siblings = lessons
    .filter((l) => l.child.id !== who.childRecordId)
    .map((l) => ({ name: l.child.firstName, booking: { kind: l.enrollment.kind, timeId: l.enrollment.timeId }, holdsSpot: true }));
  const t = timesForChild({ data, poolId: draft.poolId, birthDate: who.birthDate, stage: who.stage, today, siblings });
  if (draft.mode !== "class") return t;
  const own = lessons.filter((l) => l.child.id === who.childRecordId);
  const clash = (o: TimeOption) =>
    own.some((l) => l.enrollment.timeId === o.id || (l.weekday === o.weekday && Math.abs(minutesOfDay(l.startTime) - minutesOfDay(o.startTime)) < 30));
  const classes = t.classes.filter((o) => !clash(o));
  // A child with a stage has had their evaluation; one without one can still book it.
  const evaluations = who.stage === "evaluation" ? t.evaluations.filter((o) => !clash(o)) : [];
  return { ...t, classes, evaluations, nothingFits: !classes.some((c) => !c.full) };
}

export function addBookingFits(data: Readonly<AppData>, draft: AddDraft, today: DateOnly): boolean {
  const booking = draft.kid.booking;
  if (!booking) return true;
  const t = addTimes(data, draft, today);
  if (!t) return false;
  const list = booking.kind === "class" ? t.classes : t.evaluations;
  return list.some((o) => o.id === booking.timeId && !o.full);
}

export function addProblem(data: Readonly<AppData>, draft: AddDraft, today: DateOnly): { step: AddStepKey; message: string } | null {
  const family = data.families.find((f) => f.id === draft.familyId);
  const pool = data.pools.find((p) => p.id === draft.poolId);
  if (!family || !pool) return { step: draft.mode === "child" ? "child" : "times", message: "Start again from Add a child or a class." };
  if (draft.mode === "child") {
    if (nameProblem(draft.kid.firstName) || !draftBirthDate(draft.kid)) return { step: "child", message: "Your new swimmer needs a first name and birth date." };
    if (!draft.kid.stage) return { step: "stage", message: "Pick what sounds most like them today." };
  } else if (!addSubject(data, draft).childRecordId) {
    return { step: "times", message: "Start again from Add a child or a class." };
  }
  if (!draft.kid.booking && draft.kid.waitlistClassIds.length === 0) return { step: "times", message: "Pick a time, the waitlist or the free evaluation." };
  if (!addBookingFits(data, draft, today)) return { step: "times", message: "That time no longer fits. Please pick a time again." };
  if (draft.kid.booking?.kind === "class" && !hasLessonPayment(data, draft.familyId)) {
    return { step: "times", message: lessonPaymentNote(pool.schoolEmail) };
  }
  if (draft.kid.booking?.kind === "evaluation" && evaluationAsksForCard && !familyPayment(data, draft.familyId).main) {
    return { step: "review", message: `There's no card on file to hold the spot yet. Email us at ${pool.schoolEmail} to add one.` };
  }
  if (draft.mode === "child") {
    if (familyNeedsToSign(data, draft.familyId)) {
      const keys = [...familyChildren(data, draft.familyId).map((c) => c.id), draft.kid.key];
      const problem = draft.release ? releaseProblem(currentRelease(data), draft.release, keys) : "Please sign the current family release.";
      if (problem) return { step: "questions", message: problem };
    } else if (!draft.answers.custody || !draft.answers.health) {
      return { step: "questions", message: "Please answer yes or no to both questions." };
    }
  }
  return null;
}

/** For a family with no way to pay for lessons yet (a card that only holds a free evaluation's spot). */
export function lessonPaymentNote(schoolEmail: string): string {
  return `To add a class, a person sets up how you'll pay for lessons first. Email us at ${schoolEmail}. You can still join a waitlist or book a free evaluation.`;
}

export class AddIncompleteError extends Error {
  constructor(
    public readonly step: AddStepKey,
    message: string,
  ) {
    super(message);
    this.name = "AddIncompleteError";
  }
}

/** Adds the child or the class, books the time, and covers the child under the family release. */
export function commitAdd(
  tx: Transaction,
  input: { draftId: string; today: DateOnly; now: IsoTime; newId: () => string; browserName: string },
): { childRecordId: string; enrollmentId: string | null } {
  const { today, now, newId } = input;
  const draft = tx.get("addDrafts", input.draftId);
  // The draft is gone once added, so a second tap or a refresh adds nothing.
  if (!draft) throw new AlreadySavedError();
  const data = tx.data();
  const problem = addProblem(data, draft, today);
  if (problem) throw new AddIncompleteError(problem.step, problem.message);
  const family = tx.get("families", draft.familyId)!;
  const pool = tx.get("pools", draft.poolId)!;
  const needsSign = draft.mode === "child" && familyNeedsToSign(data, family.id);

  let childRecordId: string;
  if (draft.mode === "child") {
    const stage = draft.kid.stage;
    childRecordId = tx.add("children", {
      id: newId(),
      familyId: family.id,
      firstName: draft.kid.firstName.trim(),
      birthDate: draftBirthDate(draft.kid)!,
      childId: null,
      stageId: stage && stage !== "evaluation" ? stage : null,
      flaggedForPerson: false,
      createdAt: now,
    }).id;
  } else {
    childRecordId = draft.childRecordId!;
  }

  let enrollment: Enrollment | null = null;
  if (draft.kid.booking) {
    const cls = draft.kid.booking.kind === "class" ? tx.get("classes", draft.kid.booking.timeId) : undefined;
    enrollment = bookTime(tx, {
      familyId: family.id,
      childRecordId,
      booking: draft.kid.booking,
      poolId: pool.id,
      today,
      now,
      newId,
      alone: Boolean(cls && cls.openSpots === cls.capacity),
    });
  }
  for (const classId of draft.kid.waitlistClassIds) {
    tx.add("waitlistEntries", { id: newId(), familyId: family.id, childRecordId, poolId: pool.id, classId: classId === ANY_TIME ? null : classId, createdAt: now });
  }

  if (draft.mode === "child") {
    const version = currentRelease(data);
    const child = tx.get("children", childRecordId)!;
    if (needsSign) {
      // An older release: sign the current one once, for every child.
      const keyOf = (c: Child) => (c.id === childRecordId ? draft.kid.key : c.id);
      recordSignature(tx, {
        familyId: family.id,
        version,
        children: familyChildren(tx.data(), family.id).map((c) => ({ key: keyOf(c), child: c, answers: draft.release!.perChild[keyOf(c)] })),
        release: draft.release!,
        confirmedEmail: family.confirmedEmail ?? family.email,
        schoolEmail: pool.schoolEmail,
        browserName: input.browserName,
        now,
        newId,
      });
    } else {
      // The current release already covers the family: nothing to sign, a coverage row with this child's answers.
      const a = draft.answers;
      const answers = { custodyYes: a.custody === "yes", healthYes: a.health === "yes", choices: { research: a.research, marketing: a.marketing, underwater: a.underwater } };
      const coverage = addChildCoverage(tx, { familyId: family.id, childRecordId, at: now, id: newId(), answers })!;
      for (const ch of version.choices) {
        tx.add("consents", {
          id: newId(),
          familyId: family.id,
          signatureId: coverage.signatureId,
          kind: ch.key,
          childRecordId,
          given: Boolean(a[ch.key]),
          words: consentWords(ch.key, version.choices, child.firstName, pool.schoolEmail),
          wordingVersion: `release-${version.id}`,
          at: now,
        });
      }
      // A yes goes to a person before the first lesson.
      if (answers.custodyYes || answers.healthYes) tx.update("children", childRecordId, { flaggedForPerson: true });
    }
  }

  tx.remove("addDrafts", draft.id);
  return { childRecordId, enrollmentId: enrollment?.id ?? null };
}

/** The newest thing added to a family after it signed up: a lesson, or a child waiting on a waitlist. */
export function latestAddition(data: Readonly<AppData>, familyId: string): { child: Child; enrollment: Enrollment | null } | null {
  const family = data.families.find((f) => f.id === familyId);
  if (!family) return null;
  const newest = <T extends { createdAt: string }>(rows: T[]) => [...rows].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
  const enrollment = newest(data.enrollments.filter((e) => e.familyId === familyId && !e.endedOn && e.createdAt > family.createdAt));
  const child = newest(data.children.filter((c) => c.familyId === familyId && c.createdAt > family.createdAt));
  if (child && (!enrollment || child.createdAt > enrollment.createdAt)) return { child, enrollment: null };
  if (!enrollment) return null;
  return { child: data.children.find((c) => c.id === enrollment.childRecordId)!, enrollment };
}

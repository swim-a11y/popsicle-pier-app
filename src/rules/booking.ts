/*
  "Sign and save my spot" and finishing a move-over, each as one
  transaction: everything lands together or nothing does.
*/
import { evaluationAsksForCard as defaultEvalAsksForCard } from "@/config";
import { BANK_DRAFT_WORDING_VERSION, bankDraftWords } from "@/content/payment";
import { CONSENT_WORDING_VERSION, consentWords } from "@/content/release";
import { isParentOrGuardian } from "@/content/sign-up";
import type { Transaction } from "@/data/store";
import {
  ANY_TIME,
  type AppData,
  type Child,
  type ChoiceKey,
  type ConsentRecord,
  type DateOnly,
  type DraftChildRelease,
  type Enrollment,
  type IsoTime,
  type ReleaseGroupKey,
  type ReleaseSignature,
  type ReleaseVersion,
  type SignUpDraft,
} from "@/data/types";
import { sha256Hex } from "@/lib/sha256";
import { ensureChildId, nextProcessorRef } from "@/rules/child-id";
import { closedDates, skippedDates } from "@/rules/closures";
import { firstOpenLessonDate } from "@/rules/dates";
import { datesFullOfOneOffs, heldByWaitlistOffers } from "@/rules/holds";
import { buildReleaseView, currentRelease, EIGHT_GROUPS, releaseViewText } from "@/rules/release";
import { draftBirthDate, emailProblem, nameProblem, needsPayment, phoneProblem, type StepKey } from "@/rules/sign-up";
import { timesForChild } from "@/rules/times";

export const DEVICE_ID = "this-phone";

export class SignUpIncompleteError extends Error {
  constructor(
    public readonly step: StepKey,
    public readonly child: number,
    message: string,
  ) {
    super(message);
    this.name = "SignUpIncompleteError";
  }
}

/** The draft is gone once saved, so a second tap or a refresh can't book twice. */
export class AlreadySavedError extends Error {
  constructor() {
    super("This sign-up was already saved.");
    this.name = "AlreadySavedError";
  }
}

export class TimeFilledError extends Error {
  constructor(public readonly childName: string) {
    super(`The time picked for ${childName} just filled up. Please pick another time.`);
    this.name = "TimeFilledError";
  }
}

type Missing = { step: StepKey; child: number; message: string };

export function bookingKinds(draft: Pick<SignUpDraft, "children">): { hasClass: boolean; hasEval: boolean } {
  return {
    hasClass: draft.children.some((c) => c.booking?.kind === "class"),
    hasEval: draft.children.some((c) => c.booking?.kind === "evaluation"),
  };
}

/** What the payment step must hold before signing. */
export function paymentProblem(
  p: SignUpDraft["payment"],
  kinds: { hasClass: boolean; hasEval: boolean },
  evaluationAsksForCard: boolean,
): string | null {
  const { hasClass, hasEval } = kinds;
  if (hasClass) {
    if (!p.main) return "Pick bank draft or card.";
    if (p.main === "bank" && !p.authorized) return "Please check the box to authorize the bank drafts.";
    if (p.main === "bank" && !p.backupCard) return "Please add the backup card.";
    return null;
  }
  if (hasEval && evaluationAsksForCard && !p.holdCard) return "Please add a card to hold the spot.";
  return null;
}

/** The release step's checks, shared by sign-up and moving over. */
export function releaseProblem(
  version: ReleaseVersion,
  release: SignUpDraft["release"],
  childKeys: string[],
): string | null {
  for (const g of version.groups) if (!release.groups[g.key]) return `Please check the box for "${g.title}".`;
  for (const key of childKeys) {
    const r = release.perChild[key];
    if (!r || !r.custody || !r.health) return "Please answer yes or no to both questions for each child.";
  }
  if (!release.typedName.trim()) return "Please type your full name.";
  if (!release.agreeElectronic) return "Please check the box to sign electronically.";
  return null;
}

/** A booked time must still fit the child: age on its first lesson date, stage, under 3 private only, the pool. */
export function bookingStillFits(data: Readonly<AppData>, draft: SignUpDraft, childIndex: number, today: DateOnly): boolean {
  const c = draft.children[childIndex];
  const birth = draftBirthDate(c);
  if (!c.booking) return true;
  if (!birth || !c.stage || !draft.poolId) return false;
  const siblings = draft.children.filter((_, i) => i !== childIndex).map((x) => ({ name: x.firstName, booking: x.booking }));
  const t = timesForChild({ data, poolId: draft.poolId, birthDate: birth, stage: c.stage, today, siblings });
  const list = c.booking.kind === "class" ? t.classes : t.evaluations;
  return list.some((o) => o.id === c.booking!.timeId);
}

export function firstMissingStep(data: Readonly<AppData>, draft: SignUpDraft, today: DateOnly, evaluationAsksForCard = defaultEvalAsksForCard): Missing | null {
  if (!draft.poolId || !data.pools.some((p) => p.id === draft.poolId)) return { step: "pool", child: 0, message: "Pick a pool." };
  if (draft.children.length === 0) return { step: "swimmers", child: 0, message: "Add a swimmer." };
  for (const c of draft.children) {
    if (nameProblem(c.firstName) || !draftBirthDate(c)) return { step: "swimmers", child: 0, message: "Each swimmer needs a first name and birth date." };
  }
  for (const [i, c] of draft.children.entries()) if (!c.stage) return { step: "stage", child: i + 1, message: "Pick what sounds most like your swimmer." };
  for (const [i, c] of draft.children.entries()) {
    if (!c.booking && c.waitlistClassIds.length === 0) return { step: "times", child: i + 1, message: "Pick a time, the waitlist or the free evaluation." };
    if (!bookingStillFits(data, draft, i, today)) return { step: "times", child: i + 1, message: `The time picked for ${c.firstName} no longer fits. Please pick a time again.` };
  }
  if (nameProblem(draft.fullName, "your name") || emailProblem(draft.email) || phoneProblem(draft.phone)) {
    return { step: "you", child: 0, message: "Your name, email and phone are needed." };
  }
  if (!draft.confirmedEmail || draft.confirmedEmail !== draft.email.trim()) return { step: "you", child: 0, message: "Please confirm your email with the code." };
  if (!draft.heardFrom) return { step: "you", child: 0, message: "Please tell us how you heard about us." };
  if (draft.contacts.length < 2 || draft.contacts.some((c) => nameProblem(c.name, "a name") || phoneProblem(c.phone))) {
    return { step: "people", child: 0, message: "Two emergency contacts are needed." };
  }
  if (draft.messageAdults.some((m) => nameProblem(m.name, "a name") || emailProblem(m.email))) {
    return { step: "people", child: 0, message: "Each adult who gets our messages needs a name and email." };
  }
  if (!draft.peopleDone) return { step: "people", child: 0, message: "Please finish your people." };
  if (!draft.justMe && draft.listedAdults.length === 0) return { step: "who-stays", child: 0, message: "Tell us who stays, or tap Just me for now." };
  if (needsPayment(draft, evaluationAsksForCard)) {
    const problem = paymentProblem(draft.payment, bookingKinds(draft), evaluationAsksForCard);
    if (problem) return { step: "payment", child: 0, message: problem };
  }
  const problem = releaseProblem(currentRelease(data), draft.release, draft.children.map((c) => c.key));
  if (problem) return { step: "release", child: 0, message: problem };
  return null;
}

/** Adds the payment methods (references only) and, for bank draft, its authorization row. */
export function recordPayment(
  tx: Transaction,
  input: {
    familyId: string;
    payment: SignUpDraft["payment"];
    hasClass: boolean;
    confirmedEmail: string;
    schoolEmail: string;
    now: IsoTime;
    newId: () => string;
  },
): void {
  const { familyId, payment, now, newId } = input;
  const addMethod = (kind: "bank" | "card", job: "main" | "backup") =>
    tx.add("paymentMethods", { id: newId(), familyId, kind, job, processorRef: nextProcessorRef(tx), addedAt: now });

  if (input.hasClass && payment.main) {
    const main = addMethod(payment.main, "main");
    if (payment.main === "bank") {
      tx.add("bankDraftAuthorizations", {
        id: newId(),
        familyId,
        paymentMethodId: main.id,
        processorRef: main.processorRef,
        words: bankDraftWords(input.schoolEmail),
        wordingVersion: BANK_DRAFT_WORDING_VERSION,
        confirmedEmail: input.confirmedEmail,
        authorizedAt: now,
      });
      if (payment.backupCard) addMethod("card", "backup");
    }
  } else if (payment.holdCard) {
    addMethod("card", "main");
  }
}

/** Adds one signature for every child named, and each consent as its own row. */
export function recordSignature(
  tx: Transaction,
  input: {
    familyId: string;
    version: ReleaseVersion;
    children: { key: string; child: Child; answers: DraftChildRelease }[];
    release: SignUpDraft["release"];
    confirmedEmail: string;
    schoolEmail: string;
    browserName: string;
    now: IsoTime;
    newId: () => string;
  },
): ReleaseSignature {
  const { familyId, version, children, release, now, newId } = input;
  const view = buildReleaseView(version, children.map((c) => ({ key: c.key, firstName: c.child.firstName })), input.schoolEmail);
  const choiceKeys = version.choices.map((c) => c.key);
  const consents: ConsentRecord[] = [];
  for (const c of children) {
    for (const key of choiceKeys) {
      consents.push({
        kind: key,
        childRecordId: c.child.id,
        given: Boolean(c.answers[key]),
        words: consentWords(key, version.choices, c.child.firstName, input.schoolEmail),
        wordingVersion: `release-${version.id}`,
      });
    }
  }
  consents.push(
    { kind: "texts", childRecordId: null, given: release.texts, words: consentWords("texts", version.choices), wordingVersion: CONSENT_WORDING_VERSION },
    { kind: "newsletter", childRecordId: null, given: release.newsletter, words: consentWords("newsletter", version.choices), wordingVersion: CONSENT_WORDING_VERSION },
    {
      kind: "marketing-emails",
      childRecordId: null,
      given: release.marketingEmails,
      words: consentWords("marketing-emails", version.choices),
      wordingVersion: CONSENT_WORDING_VERSION,
    },
  );

  const groupsAgreed = Object.fromEntries(EIGHT_GROUPS.map((g) => [g.key, Boolean(release.groups[g.key])])) as Record<ReleaseGroupKey, boolean>;
  const signature = tx.add("releaseSignatures", {
    id: newId(),
    familyId,
    versionId: version.id,
    typedName: release.typedName.trim(),
    groupsAgreed,
    children: children.map((c) => {
      const fresh = tx.get("children", c.child.id) ?? c.child;
      return {
        childRecordId: c.child.id,
        firstName: c.child.firstName,
        childId: fresh.childId,
        custodyYes: c.answers.custody === "yes",
        healthYes: c.answers.health === "yes",
        choices: Object.fromEntries((["research", "marketing", "underwater"] as ChoiceKey[]).map((k) => [k, choiceKeys.includes(k) && Boolean(c.answers[k])])) as Record<ChoiceKey, boolean>,
      };
    }),
    childIds: children.map((c) => (tx.get("children", c.child.id) ?? c.child).childId).filter((x): x is string => Boolean(x)),
    textSha256: sha256Hex(releaseViewText(view)),
    signedAt: now,
    signedHow: "online",
    confirmedEmail: input.confirmedEmail,
    browserName: input.browserName,
    agreedToSignElectronically: release.agreeElectronic,
    consents,
  });
  for (const c of consents) tx.add("consents", { ...c, id: newId(), familyId, signatureId: signature.id, at: now });
  // A yes on custody or health goes to a person before the first lesson.
  for (const c of children) {
    if (c.answers.custody === "yes" || c.answers.health === "yes") tx.update("children", c.child.id, { flaggedForPerson: true });
  }
  return signature;
}

export function setCurrentFamily(tx: Transaction, familyId: string | null, role: "parent" | "moving" | "owner"): void {
  const device = tx.get("deviceStates", DEVICE_ID);
  if (device) tx.update("deviceStates", DEVICE_ID, { currentFamilyId: familyId, role });
  else tx.add("deviceStates", { id: DEVICE_ID, role, currentFamilyId: familyId });
}

/**
 * Books one child into one time: gives the child an ID if this is their
 * first booking (the ID never changes after), adds the enrollment with its
 * first open lesson date, and takes one spot. "alone" marks a semi-private
 * time the child starts with no partner.
 */
export function bookTime(
  tx: Transaction,
  input: {
    familyId: string;
    childRecordId: string;
    booking: { kind: "class" | "evaluation"; timeId: string };
    poolId: string;
    today: DateOnly;
    now: IsoTime;
    newId: () => string;
    alone: boolean;
    /** Booking the spot a waitlist offer held: that offer's own hold doesn't count against it. */
    offerId?: string;
  },
): Enrollment {
  const { familyId, childRecordId, booking, today, now, newId } = input;
  const pool = tx.get("pools", input.poolId);
  if (!pool) throw new Error("No such pool.");
  const closed = closedDates(tx.data(), pool.id);
  ensureChildId(tx, childRecordId, today);
  if (booking.kind === "class") {
    const cls = tx.get("classes", booking.timeId);
    if (!cls || cls.poolId !== pool.id) throw new Error("No such class at that pool.");
    // A spot a person has offered to someone on the waitlist is held while they answer.
    if (cls.openSpots - heldByWaitlistOffers(tx.data(), cls.id, today, input.offerId) < 1) {
      throw new TimeFilledError(tx.get("children", childRecordId)?.firstName ?? "your swimmer");
    }
    const lt = tx.get("lessonTypes", cls.lessonTypeId)!;
    const first = firstOpenLessonDate(cls.weekday, today, pool.opensOn, skippedDates(tx.data(), cls, today));
    const enrollment = tx.add("enrollments", {
      id: newId(),
      familyId,
      childRecordId,
      kind: "class",
      poolId: pool.id,
      timeId: cls.id,
      lessonTypeId: lt.id,
      firstLessonDate: first,
      unpairedSince: lt.kind === "semi-private" && input.alone ? first : null,
      createdAt: now,
    });
    tx.update("classes", cls.id, { openSpots: cls.openSpots - 1 });
    return enrollment;
  }
  const ev = tx.get("evaluationTimes", booking.timeId);
  if (!ev || ev.poolId !== pool.id) throw new Error("No such evaluation time at that pool.");
  if (ev.openSpots < 1) throw new TimeFilledError(tx.get("children", childRecordId)?.firstName ?? "your swimmer");
  const enrollment = tx.add("enrollments", {
    id: newId(),
    familyId,
    childRecordId,
    kind: "evaluation",
    poolId: pool.id,
    timeId: ev.id,
    lessonTypeId: null,
    firstLessonDate: firstOpenLessonDate(ev.weekday, today, pool.opensOn, [...closed, ...datesFullOfOneOffs(tx.data(), ev, today)]),
    unpairedSince: null,
    createdAt: now,
  });
  tx.update("evaluationTimes", ev.id, { openSpots: ev.openSpots - 1 });
  return enrollment;
}

export interface SignAndSaveInput {
  draft: SignUpDraft;
  today: DateOnly;
  now: IsoTime;
  browserName: string;
  newId: () => string;
  evaluationAsksForCard?: boolean;
}

/** Books every child once, saves the release and payment, drops spots, clears the draft. */
export function signAndSave(tx: Transaction, input: SignAndSaveInput): { familyId: string } {
  const { draft, today, now, newId } = input;
  const evalAsks = input.evaluationAsksForCard ?? defaultEvalAsksForCard;
  const data = tx.data();
  if (!tx.get("signUpDrafts", draft.id)) throw new AlreadySavedError();
  const missing = firstMissingStep(data, draft, today, evalAsks);
  if (missing) throw new SignUpIncompleteError(missing.step, missing.child, missing.message);

  const pool = data.pools.find((p) => p.id === draft.poolId)!;
  const countPicks = (kind: "class" | "evaluation", timeId: string) =>
    draft.children.filter((c) => c.booking?.kind === kind && c.booking.timeId === timeId).length;
  for (const c of draft.children) {
    if (!c.booking) continue;
    const time = c.booking.kind === "class" ? tx.get("classes", c.booking.timeId) : tx.get("evaluationTimes", c.booking.timeId);
    if (!time || time.openSpots < countPicks(c.booking.kind, c.booking.timeId)) throw new TimeFilledError(c.firstName.trim());
  }

  const familyId = newId();
  const email = draft.email.trim();
  tx.add("families", {
    id: familyId,
    createdAt: now,
    homePoolId: pool.id,
    parentFullName: draft.fullName.trim(),
    email,
    phone: draft.phone.trim(),
    confirmedEmail: draft.confirmedEmail,
    emailConfirmedAt: now,
    heardFrom: draft.heardFrom,
    source: "sign-up",
    movedOverAt: null,
    movingOverChecks: [],
  });
  draft.contacts.forEach((c, i) =>
    tx.add("emergencyContacts", { id: newId(), familyId, name: c.name.trim(), phone: c.phone.trim(), order: i + 1, createdAt: now }),
  );
  for (const m of draft.messageAdults) tx.add("messageOnlyAdults", { id: newId(), familyId, name: m.name.trim(), email: m.email.trim(), createdAt: now });
  for (const a of draft.listedAdults) {
    tx.add("listedAdults", {
      id: newId(),
      familyId,
      firstName: a.firstName.trim(),
      relationship: a.relationship,
      isParentOrGuardian: isParentOrGuardian(a.relationship),
      // Today's rule: listed adults sign on paper at the check-in desk.
      status: "waiting",
      signedHow: null,
      signedAt: null,
      createdAt: now,
    });
  }

  const signed: { key: string; child: Child; answers: DraftChildRelease }[] = [];
  const spotsTaken = new Map<string, number>();
  for (const c of draft.children) {
    const child = tx.add("children", {
      id: newId(),
      familyId,
      firstName: c.firstName.trim(),
      birthDate: draftBirthDate(c)!,
      childId: null,
      stageId: c.stage && c.stage !== "evaluation" ? c.stage : null,
      flaggedForPerson: false,
      createdAt: now,
    });
    if (c.booking) {
      // A semi-private time two siblings book together gives each a partner.
      const cls = c.booking.kind === "class" ? tx.get("classes", c.booking.timeId) : undefined;
      const nobodyYet = cls ? cls.openSpots + (spotsTaken.get(cls.id) ?? 0) === cls.capacity : false;
      const alone = Boolean(cls) && nobodyYet && countPicks("class", c.booking.timeId) === 1;
      bookTime(tx, { familyId, childRecordId: child.id, booking: c.booking, poolId: pool.id, today, now, newId, alone });
      if (cls) spotsTaken.set(cls.id, (spotsTaken.get(cls.id) ?? 0) + 1);
    }
    for (const classId of c.waitlistClassIds) {
      tx.add("waitlistEntries", { id: newId(), familyId, childRecordId: child.id, poolId: pool.id, classId: classId === ANY_TIME ? null : classId, createdAt: now });
    }
    signed.push({ key: c.key, child: tx.get("children", child.id)!, answers: draft.release.perChild[c.key] });
  }

  recordPayment(tx, {
    familyId,
    payment: needsPayment(draft, evalAsks) ? draft.payment : { main: null, authorized: false, backupCard: false, holdCard: false },
    hasClass: bookingKinds(draft).hasClass,
    confirmedEmail: draft.confirmedEmail!,
    schoolEmail: pool.schoolEmail,
    now,
    newId,
  });
  recordSignature(tx, {
    familyId,
    version: currentRelease(data),
    children: signed,
    release: draft.release,
    confirmedEmail: draft.confirmedEmail!,
    schoolEmail: pool.schoolEmail,
    browserName: input.browserName,
    now,
    newId,
  });
  setCurrentFamily(tx, familyId, "parent");
  tx.remove("signUpDrafts", draft.id);
  return { familyId };
}

export const MOVE_OVER_CHECKS = ["details", "people", "classes"] as const;

export function moveOverDraftId(familyId: string): string {
  return `move-over:${familyId}`;
}

/**
 * Moving over: the school already has the family, children and classes.
 * The family confirms its email, links its bank again, and signs the
 * current release once for every child.
 */
export function finishMovingOver(
  tx: Transaction,
  input: { familyId: string; draft: SignUpDraft; browserName: string; now: IsoTime; newId: () => string },
): void {
  const { familyId, draft, now, newId } = input;
  const data = tx.data();
  const family = tx.get("families", familyId);
  if (!family) throw new Error("No such family.");
  // Signed once for everyone: revisiting the steps can't add a second signature or authorization.
  if (family.movedOverAt) throw new AlreadySavedError();
  for (const check of MOVE_OVER_CHECKS) if (!family.movingOverChecks.includes(check)) throw new SignUpIncompleteError("you", 0, `Please check your ${check}.`);
  if (draft.confirmedEmail !== family.email) throw new SignUpIncompleteError("you", 0, "Please confirm your email with the code.");
  const children = data.children.filter((c) => c.familyId === familyId);
  const payProblem = paymentProblem(draft.payment, { hasClass: true, hasEval: false }, false);
  if (payProblem) throw new SignUpIncompleteError("payment", 0, payProblem);
  const version = currentRelease(data);
  const relProblem = releaseProblem(version, draft.release, children.map((c) => c.id));
  if (relProblem) throw new SignUpIncompleteError("release", 0, relProblem);

  const schoolEmail = data.pools.find((p) => p.id === family.homePoolId)?.schoolEmail ?? "";
  recordPayment(tx, { familyId, payment: draft.payment, hasClass: true, confirmedEmail: family.email, schoolEmail, now, newId });
  recordSignature(tx, {
    familyId,
    version,
    children: children.map((c) => ({ key: c.id, child: c, answers: draft.release.perChild[c.id] })),
    release: draft.release,
    confirmedEmail: family.email,
    schoolEmail,
    browserName: input.browserName,
    now,
    newId,
  });
  tx.update("families", familyId, { confirmedEmail: family.email, emailConfirmedAt: now, movedOverAt: now });
  setCurrentFamily(tx, familyId, "moving");
  if (tx.get("signUpDrafts", draft.id)) tx.remove("signUpDrafts", draft.id);
}

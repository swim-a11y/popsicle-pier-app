/*
  "Sign and save my spot" and finishing a move-over, each as one
  transaction: everything lands together or nothing does.
*/
import { evaluationAsksForCard as defaultEvalAsksForCard } from "@/config";
import { BANK_DRAFT_WORDING_VERSION, bankDraftWords } from "@/content/payment";
import { CONSENT_WORDING_VERSION, consentWords } from "@/content/release";
import { isParentOrGuardian } from "@/content/sign-up";
import type { Transaction } from "@/data/store";
import type {
  AppData,
  Child,
  ChoiceKey,
  ConsentRecord,
  DateOnly,
  DraftChildRelease,
  IsoTime,
  ReleaseGroupKey,
  ReleaseSignature,
  ReleaseVersion,
  SignUpDraft,
} from "@/data/types";
import { sha256Hex } from "@/lib/sha256";
import { ensureChildId, nextProcessorRef } from "@/rules/child-id";
import { firstLessonDate } from "@/rules/dates";
import { buildReleaseView, currentRelease, EIGHT_GROUPS, releaseViewText } from "@/rules/release";
import { draftBirthDate, emailProblem, nameProblem, needsPayment, phoneProblem, type StepKey } from "@/rules/sign-up";

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

export function firstMissingStep(data: Readonly<AppData>, draft: SignUpDraft, evaluationAsksForCard = defaultEvalAsksForCard): Missing | null {
  if (!draft.poolId || !data.pools.some((p) => p.id === draft.poolId)) return { step: "pool", child: 0, message: "Pick a pool." };
  if (draft.children.length === 0) return { step: "swimmers", child: 0, message: "Add a swimmer." };
  for (const c of draft.children) {
    if (nameProblem(c.firstName) || !draftBirthDate(c)) return { step: "swimmers", child: 0, message: "Each swimmer needs a first name and birth date." };
  }
  for (const [i, c] of draft.children.entries()) if (!c.stage) return { step: "stage", child: i + 1, message: "Pick what sounds most like your swimmer." };
  for (const [i, c] of draft.children.entries()) {
    if (!c.booking && c.waitlistClassIds.length === 0) return { step: "times", child: i + 1, message: "Pick a time, the waitlist or the free evaluation." };
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
        words: bankDraftWords(),
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
    browserName: string;
    now: IsoTime;
    newId: () => string;
  },
): ReleaseSignature {
  const { familyId, version, children, release, now, newId } = input;
  const view = buildReleaseView(version, children.map((c) => ({ key: c.key, firstName: c.child.firstName })));
  const choiceKeys = version.choices.map((c) => c.key);
  const consents: ConsentRecord[] = [];
  for (const c of children) {
    for (const key of choiceKeys) {
      consents.push({
        kind: key,
        childRecordId: c.child.id,
        given: Boolean(c.answers[key]),
        words: consentWords(key, version.choices, c.child.firstName),
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
  const missing = firstMissingStep(data, draft, evalAsks);
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
      ensureChildId(tx, child.id, today);
      if (c.booking.kind === "class") {
        const cls = tx.get("classes", c.booking.timeId)!;
        const lt = tx.get("lessonTypes", cls.lessonTypeId)!;
        const first = firstLessonDate(cls.weekday, today, pool.opensOn);
        const nobodyYet = cls.openSpots + (spotsTaken.get(cls.id) ?? 0) === cls.capacity;
        const alone = nobodyYet && countPicks("class", cls.id) === 1;
        tx.add("enrollments", {
          id: newId(),
          familyId,
          childRecordId: child.id,
          kind: "class",
          poolId: pool.id,
          timeId: cls.id,
          lessonTypeId: lt.id,
          firstLessonDate: first,
          unpairedSince: lt.kind === "semi-private" && alone ? first : null,
          createdAt: now,
        });
        tx.update("classes", cls.id, { openSpots: cls.openSpots - 1 });
        spotsTaken.set(cls.id, (spotsTaken.get(cls.id) ?? 0) + 1);
      } else {
        const ev = tx.get("evaluationTimes", c.booking.timeId)!;
        tx.add("enrollments", {
          id: newId(),
          familyId,
          childRecordId: child.id,
          kind: "evaluation",
          poolId: pool.id,
          timeId: ev.id,
          lessonTypeId: null,
          firstLessonDate: firstLessonDate(ev.weekday, today, pool.opensOn),
          unpairedSince: null,
          createdAt: now,
        });
        tx.update("evaluationTimes", ev.id, { openSpots: ev.openSpots - 1 });
      }
    }
    for (const classId of c.waitlistClassIds) tx.add("waitlistEntries", { id: newId(), familyId, childRecordId: child.id, classId, createdAt: now });
    signed.push({ key: c.key, child: tx.get("children", child.id)!, answers: draft.release.perChild[c.key] });
  }

  recordPayment(tx, {
    familyId,
    payment: needsPayment(draft, evalAsks) ? draft.payment : { main: null, authorized: false, backupCard: false, holdCard: false },
    hasClass: bookingKinds(draft).hasClass,
    confirmedEmail: draft.confirmedEmail!,
    now,
    newId,
  });
  recordSignature(tx, {
    familyId,
    version: currentRelease(data),
    children: signed,
    release: draft.release,
    confirmedEmail: draft.confirmedEmail!,
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
  for (const check of MOVE_OVER_CHECKS) if (!family.movingOverChecks.includes(check)) throw new SignUpIncompleteError("you", 0, `Please check your ${check}.`);
  if (draft.confirmedEmail !== family.email) throw new SignUpIncompleteError("you", 0, "Please confirm your email with the code.");
  const children = data.children.filter((c) => c.familyId === familyId);
  const payProblem = paymentProblem(draft.payment, { hasClass: true, hasEval: false }, false);
  if (payProblem) throw new SignUpIncompleteError("payment", 0, payProblem);
  const version = currentRelease(data);
  const relProblem = releaseProblem(version, draft.release, children.map((c) => c.id));
  if (relProblem) throw new SignUpIncompleteError("release", 0, relProblem);

  recordPayment(tx, { familyId, payment: draft.payment, hasClass: true, confirmedEmail: family.email, now, newId });
  recordSignature(tx, {
    familyId,
    version,
    children: children.map((c) => ({ key: c.id, child: c, answers: draft.release.perChild[c.id] })),
    release: draft.release,
    confirmedEmail: family.email,
    browserName: input.browserName,
    now,
    newId,
  });
  tx.update("families", familyId, { confirmedEmail: family.email, emailConfirmedAt: now, movedOverAt: now });
  setCurrentFamily(tx, familyId, "moving");
  if (tx.get("signUpDrafts", draft.id)) tx.remove("signUpDrafts", draft.id);
}

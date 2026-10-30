/*
  Sign-up: which steps this family needs, what each field accepts, and the
  draft that keeps their place.
*/
import type { DateOnly, DraftChild, SignUpDraft } from "@/data/types";
import { ageInMonths, isValidDate, makeDate } from "@/rules/dates";

export type StepKey = "pool" | "swimmers" | "stage" | "times" | "you" | "people" | "who-stays" | "payment" | "release";

export const STEP_PATH: Record<StepKey, string> = {
  pool: "/sign-up/pool",
  swimmers: "/sign-up/swimmers",
  stage: "/sign-up/stage",
  times: "/sign-up/times",
  you: "/sign-up/you",
  people: "/sign-up/people",
  "who-stays": "/sign-up/who-stays",
  payment: "/sign-up/payment",
  release: "/sign-up/release",
};

export const PER_CHILD: readonly StepKey[] = ["stage", "times"];

export interface StepRef {
  key: StepKey;
  /** 1-based for the per-child steps, 0 otherwise. */
  child: number;
  href: string;
}

export function stepHref(key: StepKey, child = 0): string {
  return PER_CHILD.includes(key) ? `${STEP_PATH[key]}?child=${Math.max(1, child)}` : STEP_PATH[key];
}

/** Payment is skipped only when every child is settled and nothing booked needs it. */
export function needsPayment(draft: SignUpDraft | null, evaluationAsksForCard: boolean): boolean {
  if (!draft || draft.children.length === 0) return true;
  if (draft.children.some((c) => !c.booking && c.waitlistClassIds.length === 0)) return true;
  if (draft.children.some((c) => c.booking?.kind === "class")) return true;
  if (draft.children.some((c) => c.booking?.kind === "evaluation")) return evaluationAsksForCard;
  return false;
}

/** "Step 3 of 9" counts only the steps this family needs. */
export function signUpSteps(draft: SignUpDraft | null, evaluationAsksForCard: boolean): StepRef[] {
  const n = Math.max(1, draft?.children.length ?? 1);
  const steps: StepRef[] = [
    { key: "pool", child: 0, href: stepHref("pool") },
    { key: "swimmers", child: 0, href: stepHref("swimmers") },
  ];
  for (let i = 1; i <= n; i++) steps.push({ key: "stage", child: i, href: stepHref("stage", i) });
  for (let i = 1; i <= n; i++) steps.push({ key: "times", child: i, href: stepHref("times", i) });
  steps.push({ key: "you", child: 0, href: stepHref("you") });
  steps.push({ key: "people", child: 0, href: stepHref("people") });
  steps.push({ key: "who-stays", child: 0, href: stepHref("who-stays") });
  if (needsPayment(draft, evaluationAsksForCard)) steps.push({ key: "payment", child: 0, href: stepHref("payment") });
  steps.push({ key: "release", child: 0, href: stepHref("release") });
  return steps;
}

export function findStep(steps: StepRef[], key: StepKey, child = 0): number {
  const c = PER_CHILD.includes(key) ? Math.max(1, child) : 0;
  return steps.findIndex((s) => s.key === key && s.child === c);
}

export function emptyDraft(id: string, now: string): SignUpDraft {
  return {
    id,
    startedAt: now,
    updatedAt: now,
    lastPath: STEP_PATH.pool,
    poolId: null,
    children: [],
    fullName: "",
    email: "",
    phone: "",
    codeSent: false,
    code: "",
    confirmedEmail: null,
    heardFrom: null,
    contacts: [
      { name: "", phone: "" },
      { name: "", phone: "" },
    ],
    messageAdults: [],
    peopleDone: false,
    listedAdults: [],
    justMe: false,
    payment: { main: null, authorized: false, backupCard: false, holdCard: false },
    release: { groups: {}, perChild: {}, texts: false, newsletter: false, marketingEmails: false, typedName: "", agreeElectronic: false },
  };
}

export function emptyDraftChild(key: string): DraftChild {
  return { key, firstName: "", birthMonth: "", birthDay: "", birthYear: "", stage: null, booking: null, waitlistClassIds: [] };
}

/** Every email in sign-up ends in @example.com. */
export function emailProblem(email: string): string | null {
  const e = email.trim();
  if (!e) return "Please type an email.";
  if (!/^[^\s@]+@example\.com$/i.test(e)) return "Please use a made-up email that ends in @example.com.";
  return null;
}

/** Every phone number uses 555, like 404-555-0123. */
export function phoneProblem(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "Please type a phone number.";
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (ten.length !== 10 || ten.slice(3, 6) !== "555") return "Please use a made-up number with 555 in the middle, like 404-555-0123.";
  return null;
}

export function nameProblem(name: string, what = "a first name"): string | null {
  return name.trim() ? null : `Please type ${what}.`;
}

export function draftBirthDate(c: Pick<DraftChild, "birthMonth" | "birthDay" | "birthYear">): DateOnly | null {
  const m = Number(c.birthMonth);
  const d = Number(c.birthDay);
  const y = Number(c.birthYear);
  if (!c.birthYear || c.birthYear.length !== 4 || !isValidDate(y, m, d)) return null;
  return makeDate(y, m, d);
}

export function birthDateProblem(c: Pick<DraftChild, "birthMonth" | "birthDay" | "birthYear">, today: DateOnly): string | null {
  if (!c.birthMonth || !c.birthDay || !c.birthYear) return "Please type the month, day and year.";
  const date = draftBirthDate(c);
  if (!date) return "That date doesn't look right. Try the month as a number, like 4 for April, and a four-digit year.";
  if (date > today) return "That date hasn't happened yet.";
  if (ageInMonths(date, today) > 18 * 12) return "Lessons here are for children. Please check the year.";
  return null;
}

export function codeMatches(code: string, sampleCode: string): boolean {
  return code.trim() === sampleCode;
}

export function isFullName(name: string): boolean {
  return name.trim().split(/\s+/).filter(Boolean).length >= 2;
}

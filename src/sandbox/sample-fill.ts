/*
  "Fill in a sample family": fills every typed field of the sign-up draft
  with made-up values (one child aged 4, you, the code, emergency contacts,
  the signing name). Every choice is still a tap.
*/
import type { DateOnly, IsoTime, SignUpDraft } from "@/data/types";
import { addMonths, parseDate } from "@/rules/dates";
import { emptyDraft, emptyDraftChild } from "@/rules/sign-up";
import { SAMPLE_CODE } from "@/sandbox/sample-code";

export const SAMPLE_FAMILY = {
  childFirstName: "Mia",
  fullName: "Jordan Sample",
  email: "jordan.sample@example.com",
  phone: "404-555-0123",
  contacts: [
    { name: "Casey Sample", phone: "404-555-0188" },
    { name: "Riley Sample", phone: "404-555-0199" },
  ],
};

/** Four years and three months old today, so four on any first lesson in the next weeks. */
export function sampleBirthDate(today: DateOnly): DateOnly {
  return addMonths(today, -(4 * 12 + 3));
}

export function applySampleFill(draft: SignUpDraft | null, today: DateOnly, now: IsoTime, newKey: () => string, draftId: string): SignUpDraft {
  const base = draft ?? emptyDraft(draftId, now);
  const birth = parseDate(sampleBirthDate(today));
  const children = base.children.length > 0 ? [...base.children] : [emptyDraftChild(newKey())];
  const first = children[0];
  const filled = { firstName: SAMPLE_FAMILY.childFirstName, birthMonth: String(birth.m), birthDay: String(birth.d), birthYear: String(birth.y) };
  const birthChanged = first.birthMonth !== filled.birthMonth || first.birthDay !== filled.birthDay || first.birthYear !== filled.birthYear;
  // A new birth date means the time is picked again, so a booking never outlives the age it was picked for.
  children[0] = birthChanged ? { ...first, ...filled, booking: null, waitlistClassIds: [] } : { ...first, ...filled };
  return {
    ...base,
    updatedAt: now,
    children,
    fullName: SAMPLE_FAMILY.fullName,
    email: SAMPLE_FAMILY.email,
    phone: SAMPLE_FAMILY.phone,
    code: SAMPLE_CODE,
    contacts: SAMPLE_FAMILY.contacts.map((c) => ({ ...c })),
    release: { ...base.release, typedName: SAMPLE_FAMILY.fullName },
  };
}

import type { HeardFrom, Relationship } from "@/data/types";

export const SWIM_DIAPER_LINE =
  "Every child 3 and under, and any child who isn't toilet-trained, wears a snug reusable swim diaper.";

export const NO_PARTNER_YET =
  "No partner yet. You pay the semi-private price for the first month. If we haven't found a partner by then, we'll talk with you before anything changes.";

export const WHO_STAYS_INTRO =
  "There's no drop-off. A parent, guardian or signed listed adult stays at the pool the whole lesson, or the lesson doesn't start. Every lesson is recorded for coaching and quality work, so please tell each adult you list.";

export const SIGNS_ON_PAPER = "Signs on paper at the check-in desk before their first lesson.";

export const EMAIL_US_FIRST =
  "For now, if the only adult staying would be someone other than a parent or guardian, email us before the lesson so we can confirm it.";

export const SOMEONE_WILL_TALK = "Thanks. Someone from the school will talk with you before the first lesson.";

export const NOTHING_CHARGED_TODAY = "Nothing is charged today.";
export const EVALUATION_NEVER_CHARGED = "The free evaluation is never charged.";
export const BACKUP_CARD_LINE = "We'd only charge this card if a bank draft comes back unpaid, after we tell you, at the card price.";

export const HEARD_FROM: readonly { id: HeardFrom; label: string }[] = [
  { id: "front-desk-card", label: "A card at the front desk" },
  { id: "neighborhood-app", label: "A neighborhood app or site" },
  { id: "parent-group", label: "An online parent group" },
  { id: "school", label: "My child's school or preschool" },
  { id: "listing", label: "An online listing" },
  { id: "friend", label: "A friend, neighbor or family member" },
  { id: "web-search", label: "A web search" },
  { id: "other", label: "Other" },
];

export const RELATIONSHIPS: readonly { id: Relationship; label: string; parentOrGuardian: boolean }[] = [
  { id: "parent", label: "Parent", parentOrGuardian: true },
  { id: "guardian", label: "Guardian", parentOrGuardian: true },
  { id: "grandparent", label: "Grandparent", parentOrGuardian: false },
  { id: "nanny", label: "Nanny", parentOrGuardian: false },
  { id: "other", label: "Other", parentOrGuardian: false },
];

export function relationshipLabel(r: Relationship): string {
  return RELATIONSHIPS.find((x) => x.id === r)?.label ?? r;
}

export function isParentOrGuardian(r: Relationship): boolean {
  return RELATIONSHIPS.find((x) => x.id === r)?.parentOrGuardian ?? false;
}

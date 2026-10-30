/** SAMPLE bank-draft authorization, in our own words. Not legal language. */
export const BANK_DRAFT_WORDING_VERSION = "bank-draft-sample-1";

/** The exact lines shown, with the pool's school email (plain text, never a link). */
export function bankDraftLines(schoolEmail: string): string[] {
  return [
    "SAMPLE authorization, not legal language.",
    "We draft each month's bill from your bank account on the 1st.",
    "Every bill reaches you by the 19th, at least 10 days before its draft.",
    `You can cancel these drafts anytime by emailing us at ${schoolEmail}.`,
  ];
}

export const BANK_DRAFT_BOX = "I authorize these bank drafts";

export const BANK_DRAFT_COPY_LINE = "A copy is saved to your family's account. In the real app we'd email you a copy too.";

export function bankDraftWords(schoolEmail: string): string {
  return [...bankDraftLines(schoolEmail), BANK_DRAFT_BOX].join("\n");
}

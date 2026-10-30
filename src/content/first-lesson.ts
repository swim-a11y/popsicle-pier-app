/** Family lines for "Your first lesson". */
export const LESSON_LENGTH_LINE = "The lesson runs 27 minutes.";
export const WHO_STAYS_LINE = "You or a signed listed adult stay at the pool the whole lesson, or the lesson doesn't start. No drop-off.";
export const SIBLINGS_LINE = "Brothers and sisters wait on deck with you.";
export const RECORDED_LINE = "Every lesson is recorded for coaching and quality work.";
export const UNDER_3_BRING_LINE = "Bring your suit, you're in the water too.";

/** SAMPLE lines on how a first lesson goes. Describe; never promise. */
export function whatHappensLines(coach: string | null): string[] {
  return [
    `${coach ? `Coach ${coach}` : "Your coach"} meets you on deck and says hello.`,
    "Your swimmer spends the lesson getting comfortable in the water, at their own pace.",
    "At the end, the coach takes a minute to tell you how it went.",
  ];
}

export function emailUsLine(email: string): string {
  return `Need to miss, move or stop? Email us at ${email}.`;
}

/** When a family's lessons are at both pools, each line names its pool. */
export function emailUsLineFor(poolName: string, email: string): string {
  return `Need to miss, move or stop a ${poolName} lesson? Email us at ${email}.`;
}

export const CLIPS_LATER_LINE = "Lesson clips come in a later version.";

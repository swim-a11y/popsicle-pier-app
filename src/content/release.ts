/*
  The family release. SAMPLE placeholder words, written for this sample app;
  not legal language. Published text never changes: a change is a new
  version with its own fingerprint.
*/
import type { ConsentKind, ReleaseChoiceText, ReleaseGroup } from "@/data/types";

export const RELEASE_TITLE = "Family release";
export const RELEASE_SAMPLE_NOTE = "SAMPLE release. Placeholder words for this sample app, not legal language.";

const staying: ReleaseGroup = {
  key: "staying",
  title: "Staying at the pool",
  lines: [
    "There's no drop-off.",
    "A parent, guardian or signed listed adult stays at the pool the whole lesson.",
    "If no one is there, the lesson doesn't start. If that adult leaves, the lesson stops.",
  ],
  box: "I'll stay at the pool, or a parent, guardian or signed listed adult will.",
};

const recordingV1: ReleaseGroup = {
  key: "recording",
  title: "Recording",
  lines: [
    "Every lesson is recorded on video and audio, free first lessons too.",
    "We keep recordings as a protection record.",
    "I'll tell each adult I list that lessons are recorded.",
  ],
  box: "I understand every lesson is recorded.",
};

const recordingV2: ReleaseGroup = {
  key: "recording",
  title: "Recording",
  lines: [
    "Every lesson is recorded on video and audio, free first lessons too.",
    "Adults on deck or in the water are recorded too.",
    "We keep recordings as a protection record.",
    "I'll tell each adult I list that lessons are recorded.",
  ],
  box: "I understand every lesson is recorded.",
};

const aiReview: ReleaseGroup = {
  key: "ai-review",
  title: "AI review and our tools",
  lines: [
    "We review recordings with AI for coaching and quality work. Never for a study unless you say yes below.",
    "We match clips by roster and time slot. We don't use facial recognition.",
    "Any outside service that touches video is a business account whose terms bar training on it.",
    "Coaching data with faces removed may train our own coaching tools, used at our pools and by licensed partners.",
    "Raw video of a child is never shared with partners.",
    "Nothing is ever sold.",
  ],
  box: "I understand how recordings are reviewed and used.",
};

const whoCanWatch: ReleaseGroup = {
  key: "who-can-watch",
  title: "Who can watch",
  lines: [
    "School leaders may watch lessons live.",
    "Lessons are never streamed to families or the public.",
    "We may use video to look into an injury or a concern, and release it when the law requires.",
  ],
  box: "I understand who can watch.",
};

const keepingV1: ReleaseGroup = {
  key: "keeping",
  title: "Keeping and your family library",
  lines: [
    "Full lesson video stays in your account for the session plus 30 days.",
    "Highlights and a season reel stay as long as you have an account.",
    "A copy you download is yours to protect.",
    "Raw video is kept until your child turns 25. It's opened only for a claim, a concern or a legal requirement.",
    "Our staff never keep lesson video on personal phones or accounts.",
  ],
  box: "I understand how long things are kept.",
};

const keepingV2: ReleaseGroup = {
  key: "keeping",
  title: "Keeping and your family library",
  lines: [
    "Full lesson video stays in your account for the session plus 30 days.",
    "Highlights and a season reel stay as long as you have an account.",
    "A copy you download is yours to protect.",
    "Raw video is kept until your child turns 25. It's opened only for a claim, a concern or a legal requirement.",
    "Coaching data with faces removed is kept with no end date.",
    "At 18, your child can ask us to remove their identifiable video from coaching and study use.",
    "Our staff never keep lesson video on personal phones or accounts.",
  ],
  box: "I understand how long things are kept.",
};

const otherFamilies: ReleaseGroup = {
  key: "other-families",
  title: "Other families",
  lines: [
    "In a semi-private lesson, video and clips may show the other child.",
    "Families don't post or share video of another family's child.",
  ],
  box: "I won't post or share video of another family's child.",
};

const signing: ReleaseGroup = {
  key: "signing",
  title: "Signing for my children",
  lines: ["I'm 18 or older and have legal authority to sign for each child named."],
  box: "I'm 18 or older and can sign for each child named.",
};

const claims: ReleaseGroup = {
  key: "claims",
  title: "Release of claims",
  lines: [
    "SAMPLE paragraph, not legal language. Lessons happen in and around water, and even with care and layers of protection, a child or adult can slip, swallow water or get hurt. I accept those risks for my children and myself. I agree not to hold Popsicle Pier Swim School, its coaches or its staff responsible for ordinary accidents during lessons, except where the law says otherwise. In the real app, a lawyer writes this paragraph.",
  ],
  box: "I agree to the release of claims.",
};

/** Per child, yes or no. Each has [name] in it. */
export const CUSTODY_QUESTION =
  "Is there a court order, custody arrangement or foster placement that limits recording or who may bring [name]?";
export const HEALTH_QUESTION = "Is there anything about [name]'s health we should know before the first lesson?";

const researchV1: ReleaseChoiceText = {
  key: "research",
  title: "Research",
  lines: [
    "An observational study of how children's courage grows in lessons.",
    "A review board approves it first. You can withdraw anytime by email.",
  ],
  box: "Yes, [name] can be part of the study.",
};

/** [email] is the pool's school email, filled in where the release is shown. */
const researchV2: ReleaseChoiceText = {
  ...researchV1,
  lines: [
    "An observational study of how children's courage grows in lessons.",
    "A review board approves it first. You can withdraw anytime by emailing us at [email].",
  ],
};

const marketing: ReleaseChoiceText = {
  key: "marketing",
  title: "Our posts",
  lines: ["Photos and video in our posts, with a first name or no name."],
  box: "Yes, [name] can appear in our posts.",
};

const underwater: ReleaseChoiceText = {
  key: "underwater",
  title: "Underwater images",
  lines: ["Underwater photos and video taken during lessons."],
  box: "Yes, underwater images of [name] are fine.",
};

export const CHOICES_INTRO = "Three choices for each child. They start unchecked, and saying no never changes lessons.";

export const RELEASE_V1 = {
  groups: [staying, recordingV1, whoCanWatch, keepingV1, otherFamilies, signing, claims],
  choices: [researchV1, marketing],
};

export const RELEASE_V2 = {
  groups: [staying, recordingV2, aiReview, whoCanWatch, keepingV2, otherFamilies, signing, claims],
  choices: [researchV2, marketing, underwater],
};

/** Separate from the release, each unchecked, each with its exact words and wording version. */
export const CONSENT_WORDING_VERSION = "consents-sample-1";

export const TEXTS_CONSENT =
  "Text me about lesson cancellations and schedule changes. Message frequency varies. Message and data rates may apply. Reply STOP to opt out, HELP for help. Consent is not a condition of enrollment.";
export const NEWSLETTER_CONSENT = "Send me the Popsicle Pier email newsletter.";
export const MARKETING_EMAILS_CONSENT = "Send me marketing emails from Popsicle Pier.";

export const AGREE_ELECTRONIC = "I agree to this release and to signing it electronically";
export const SIGN_BUTTON = "Sign and save my spot";

export function consentWords(kind: ConsentKind, choices: readonly ReleaseChoiceText[], childName?: string, schoolEmail?: string): string {
  if (kind === "texts") return TEXTS_CONSENT;
  if (kind === "newsletter") return NEWSLETTER_CONSENT;
  if (kind === "marketing-emails") return MARKETING_EMAILS_CONSENT;
  const choice = choices.find((c) => c.key === kind);
  if (!choice) return "";
  const lines = choice.lines.map((l) => l.replaceAll("[email]", schoolEmail ?? "[email]"));
  return [...lines, choice.box.replaceAll("[name]", childName ?? "[name]")].join("\n");
}

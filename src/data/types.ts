/*
  The records the parent's path uses, plus the few the owner's rulings
  added (bills are worked out, not stored; owed lessons, waitlist offers,
  family notes and talk records are). Later rooms' other records are
  listed in CLAUDE.md, not here.

  Times are UTC ISO strings (shown in America/New_York). Lesson dates are
  YYYY-MM-DD. Class times are the pool's wall clock ("09:30").
*/

export type IsoTime = string;
export type DateOnly = string;

export type StageId = "pier" | "shallows" | "cove" | "open-water";
export type Relationship = "parent" | "guardian" | "grandparent" | "nanny" | "other";
export type HeardFrom =
  | "front-desk-card"
  | "neighborhood-app"
  | "parent-group"
  | "school"
  | "listing"
  | "friend"
  | "web-search"
  | "other";
export type ReleaseGroupKey =
  | "staying"
  | "recording"
  | "ai-review"
  | "who-can-watch"
  | "keeping"
  | "other-families"
  | "signing"
  | "claims";
export type ChoiceKey = "research" | "marketing" | "underwater";
export type ConsentKind = ChoiceKey | "texts" | "newsletter" | "marketing-emails";

export interface FirstLessonNotes {
  /** Short answers for the top of "Your first lesson". */
  atAGlance: { park: string; bring: string };
  address: string;
  parking: string;
  door: string;
  arrive: string;
  waitOnDeck: string;
  bring: string[];
}

export interface Pool {
  id: string;
  name: string;
  youngestAgeMonths: number;
  /** 1 or 2 swimmers per lesson; 3 by request is not built. */
  swimmersPerLesson: number[];
  /** No lesson date before this day (Buckhead opens Sunday, November 8, 2026). */
  opensOn: DateOnly | null;
  schoolEmail: string;
  firstLesson: FirstLessonNotes;
}

/** The price lives here: a lesson's price comes from the lesson type booked. */
export interface LessonType {
  id: string;
  poolId: string;
  kind: "private" | "semi-private";
  name: string;
  maxSwimmers: number;
  bankDraftCents: number;
}

/** A weekly class. Its lesson dates come from the dates rule, not stored rows. */
export interface SwimClass {
  id: string;
  poolId: string;
  lessonTypeId: string;
  /** null: a private time, which fits any stage. */
  stageId: StageId | null;
  minAgeMonths: number;
  maxAgeMonths: number;
  /** 0 is Sunday. */
  weekday: number;
  startTime: string;
  slotMinutes: number;
  lessonMinutes: number;
  instructorFirstName: string;
  capacity: number;
  openSpots: number;
  /** Under 3: a private lesson with a parent in the water. */
  parentInWater: boolean;
}

export interface EvaluationTime {
  id: string;
  poolId: string;
  weekday: number;
  startTime: string;
  slotMinutes: number;
  lessonMinutes: number;
  instructorFirstName: string;
  capacity: number;
  openSpots: number;
}

/** One meeting of a class or evaluation time, worked out by the dates rule. Not stored. */
export interface LessonDate {
  kind: "class" | "evaluation";
  timeId: string;
  poolId: string;
  date: DateOnly;
  startTime: string;
}

export interface Family {
  id: string;
  createdAt: IsoTime;
  homePoolId: string;
  parentFullName: string;
  email: string;
  phone: string;
  confirmedEmail: string | null;
  emailConfirmedAt: IsoTime | null;
  heardFrom: HeardFrom | null;
  /** How the family reached the app: sign-up here, moving over from the old system, or a seeded sample. */
  source: "sign-up" | "moving-over" | "sample";
  /** Moving over: when the family finished checking, linking and signing. */
  movedOverAt: IsoTime | null;
  /** Each step of moving over the family has checked ("Looks right"). */
  movingOverChecks: string[];
}

export interface Child {
  id: string;
  familyId: string;
  firstName: string;
  birthDate: DateOnly;
  /** PP26-0042. Set the first time the child is booked. Staff screens only. */
  childId: string | null;
  stageId: StageId | null;
  /** A custody or health yes: a person talks with the family before the first lesson. */
  flaggedForPerson: boolean;
  createdAt: IsoTime;
}

export interface ListedAdult {
  id: string;
  familyId: string;
  firstName: string;
  relationship: Relationship;
  isParentOrGuardian: boolean;
  status: "waiting" | "signed";
  signedHow: "paper-at-desk" | null;
  signedAt: IsoTime | null;
  createdAt: IsoTime;
}

export interface MessageOnlyAdult {
  id: string;
  familyId: string;
  name: string;
  email: string;
  createdAt: IsoTime;
}

export interface EmergencyContact {
  id: string;
  familyId: string;
  name: string;
  phone: string;
  order: number;
  createdAt: IsoTime;
}

export interface Enrollment {
  id: string;
  familyId: string;
  childRecordId: string;
  kind: "class" | "evaluation";
  poolId: string;
  timeId: string;
  /** Where the price comes from. null for the free evaluation, which is never charged. */
  lessonTypeId: string | null;
  firstLessonDate: DateOnly;
  /** A semi-private enrollment with no partner carries the date it became unpaired. */
  unpairedSince: DateOnly | null;
  /** The day the class ended (a switch, or a family leaving): no lessons from then on. Kept, so bills and notes still find it. */
  endedOn: DateOnly | null;
  createdAt: IsoTime;
}

/** The waitlist for a full class, or (classId null) for any time that fits at the pool. A person makes every offer. */
export interface WaitlistEntry {
  id: string;
  familyId: string;
  childRecordId: string;
  poolId: string;
  classId: string | null;
  /** Set when a person put the child on it after the family's "different time" note. */
  fromNoteId: string | null;
  createdAt: IsoTime;
}

export interface DraftChild {
  key: string;
  firstName: string;
  birthMonth: string;
  birthDay: string;
  birthYear: string;
  stage: StageId | "evaluation" | null;
  booking: { kind: "class" | "evaluation"; timeId: string } | null;
  /** Full classes to wait for; ANY_TIME means any time that fits at the pool. */
  waitlistClassIds: string[];
}

export const ANY_TIME = "any-time";

export interface DraftChildRelease {
  custody: "yes" | "no" | null;
  health: "yes" | "no" | null;
  research: boolean;
  marketing: boolean;
  underwater: boolean;
}

export interface SignUpDraft {
  id: string;
  startedAt: IsoTime;
  updatedAt: IsoTime;
  /** The step to come back to: "Pick up where you left off". */
  lastPath: string;
  poolId: string | null;
  children: DraftChild[];
  fullName: string;
  email: string;
  phone: string;
  codeSent: boolean;
  code: string;
  confirmedEmail: string | null;
  heardFrom: HeardFrom | null;
  contacts: { name: string; phone: string }[];
  messageAdults: { key: string; name: string; email: string }[];
  peopleDone: boolean;
  listedAdults: { key: string; firstName: string; relationship: Relationship }[];
  justMe: boolean;
  payment: { main: "bank" | "card" | null; authorized: boolean; backupCard: boolean; holdCard: boolean };
  release: {
    groups: Partial<Record<ReleaseGroupKey, boolean>>;
    perChild: Record<string, DraftChildRelease>;
    texts: boolean;
    newsletter: boolean;
    marketingEmails: boolean;
    typedName: string;
    agreeElectronic: boolean;
  };
}

export interface ReleaseGroup {
  key: ReleaseGroupKey;
  title: string;
  lines: string[];
  box: string;
}

export interface ReleaseChoiceText {
  key: ChoiceKey;
  title: string;
  lines: string[];
  /** Has [name] in it. */
  box: string;
}

/** Published text never changes. */
export interface ReleaseVersion {
  id: string;
  number: number;
  publishedOn: DateOnly;
  isCurrent: boolean;
  whatChanged: string[];
  groups: ReleaseGroup[];
  choices: ReleaseChoiceText[];
  /** SHA-256 of releaseTemplateText(version). A test fails if they stop matching. */
  fingerprint: string;
}

export interface SignedChild {
  childRecordId: string;
  firstName: string;
  childId: string | null;
  custodyYes: boolean;
  healthYes: boolean;
  choices: Record<ChoiceKey, boolean>;
}

export interface ConsentRecord {
  kind: ConsentKind;
  childRecordId: string | null;
  given: boolean;
  words: string;
  wordingVersion: string;
}

/** Add and list only. */
export interface ReleaseSignature {
  id: string;
  familyId: string;
  versionId: string;
  typedName: string;
  groupsAgreed: Record<ReleaseGroupKey, boolean>;
  children: SignedChild[];
  childIds: string[];
  textSha256: string;
  signedAt: IsoTime;
  signedHow: "online" | "paper-at-desk";
  confirmedEmail: string;
  browserName: string;
  agreedToSignElectronically: boolean;
  consents: ConsentRecord[];
}

/** A child added under an existing signature. Add and list only. */
/** The per-child answers a coverage row keeps for a child added after signing. */
export interface CoveredChildAnswers {
  custodyYes: boolean;
  healthYes: boolean;
  choices: Record<ChoiceKey, boolean>;
}

export interface Coverage {
  id: string;
  familyId: string;
  signatureId: string;
  versionId: string;
  childRecordId: string;
  /** The child's yes or no answers and three choices, asked when they're added. null if not asked (data layer). */
  answers: CoveredChildAnswers | null;
  addedAt: IsoTime;
}

/** Adding a brother or sister, or another class for a child: the parent's answers so far. */
export interface AddDraft {
  id: string;
  familyId: string;
  mode: "child" | "class";
  /** Another class: the child it's for. */
  childRecordId: string | null;
  poolId: string;
  /** A brother or sister: name, birth date, stage. Both: the time picked and any waitlist. */
  kid: DraftChild;
  /** A brother or sister: the two yes or no questions and three choices. */
  answers: DraftChildRelease;
  /** Only when the family signs the current release first, once for everyone. */
  release: SignUpDraft["release"] | null;
  lastPath: string;
  updatedAt: IsoTime;
}

/** Add and list only. */
export interface Consent extends ConsentRecord {
  id: string;
  familyId: string;
  signatureId: string;
  at: IsoTime;
}

/** A processor reference only. Never a card, bank, routing or account number, not even the last four. */
export interface PaymentMethod {
  id: string;
  familyId: string;
  kind: "bank" | "card";
  job: "main" | "backup";
  processorRef: string;
  addedAt: IsoTime;
}

/** Add and list only. */
export interface BankDraftAuthorization {
  id: string;
  familyId: string;
  paymentMethodId: string;
  processorRef: string;
  words: string;
  wordingVersion: string;
  confirmedEmail: string;
  authorizedAt: IsoTime;
}

export type OnDeckAdult =
  | { kind: "parent"; name: string }
  | { kind: "listed-adult"; listedAdultId: string; firstName: string; isParentOrGuardian: boolean };

export interface AttendanceMark {
  id: string;
  familyId: string;
  childRecordId: string;
  enrollmentId: string;
  poolId: string;
  lessonDate: DateOnly;
  slot: string;
  instructorFirstName: string;
  adult: OnDeckAdult;
  held: boolean;
  markedAt: IsoTime;
}

export interface LessonNote {
  id: string;
  familyId: string;
  childRecordId: string;
  attendanceMarkId: string;
  poolId: string;
  lessonDate: DateOnly;
  instructorFirstName: string;
  stageId: StageId | null;
  lineToday: string;
  lineNext: string;
  templateId: string;
  status: "draft" | "approved";
  approvedBy: string | null;
  approvedAt: IsoTime | null;
  createdAt: IsoTime;
}

export interface CoachLineTemplate {
  id: string;
  /** "evaluation" lines go with a free evaluation, which has no stage yet. */
  stageId: StageId | "evaluation";
  today: string;
  next: string;
}

/** A day a pool is closed. No lesson that day, and it isn't billed. Set by a person (Schedule room). */
export interface Closure {
  id: string;
  poolId: string;
  date: DateOnly;
  reason: string;
}

/** One class date the school cancelled (a person decides). Unlike a closed day, the lesson is owed to each child in it. */
export interface Cancellation {
  id: string;
  classId: string;
  poolId: string;
  date: DateOnly;
  reason: string;
  createdAt: IsoTime;
}

/** One date offered in place of a cancelled lesson: a class or a private (free evaluation) time of the same coach. A person picks it and sends the words. */
export interface OwedOffer {
  timeKind: "class" | "evaluation";
  timeId: string;
  date: DateOnly;
  words: string;
  offeredAt: IsoTime;
  offeredBy: string;
  answerBy: DateOnly;
  answer: "yes" | "no" | null;
  answeredAt: IsoTime | null;
}

/**
 * A lesson the school cancelled, owed to one child: one date with the child's
 * own instructor within three weeks, a week to answer, one more date, then it
 * closes with no credit. A credit only when no opening exists, and only with
 * the owner's approval.
 */
export interface OwedLesson {
  id: string;
  familyId: string;
  childRecordId: string;
  enrollmentId: string;
  cancellationId: string;
  poolId: string;
  cancelledDate: DateOnly;
  /**
   * The lesson on the family's bill this one is owed for: the cancelled class
   * date itself, or, when the school cancelled a new date or a fill-in booked
   * for a lesson, that lesson. An approved credit takes it off the bill.
   */
  billedDate: DateOnly;
  instructorFirstName: string;
  offers: OwedOffer[];
  /** The owner approved a credit because no opening exists: that lesson isn't billed. */
  creditApprovedAt: IsoTime | null;
  creditApprovedBy: string | null;
  createdAt: IsoTime;
}

/**
 * A family's own miss gets a fill-in only: same instructor, the week after.
 * A person offers one date from the family's "We'll miss" note; the family
 * answers. One fill-in only: no second date, no credit.
 */
export interface FillIn {
  id: string;
  familyId: string;
  childRecordId: string;
  /** The class and lesson the family said they'll miss, and their note. */
  enrollmentId: string;
  missedDate: DateOnly;
  noteId: string;
  poolId: string;
  instructorFirstName: string;
  offer: OwedOffer;
  createdAt: IsoTime;
}

/** A spot offered to a child on the waitlist. A person chooses who, and sends the words. */
export interface WaitlistOffer {
  id: string;
  waitlistEntryId: string;
  familyId: string;
  childRecordId: string;
  poolId: string;
  classId: string;
  /** A person chose to offer it in place of this class (a switch), or null for another class. */
  inPlaceOfEnrollmentId: string | null;
  /** Offered in reply to the family's own "different time" note. */
  fromNoteId: string | null;
  words: string;
  offeredAt: IsoTime;
  offeredBy: string;
  answerBy: DateOnly;
  answer: "yes" | "no" | null;
  answeredAt: IsoTime | null;
  /** The class booked when the family said yes. */
  enrollmentId: string | null;
}

/** A ready-made note a family sends from Messages. No free text. A person reads each one. */
export interface FamilyNote {
  id: string;
  familyId: string;
  childRecordId: string;
  kind: "miss" | "move" | "stop";
  /** A miss: the lesson it's about. */
  lessonDate: DateOnly | null;
  enrollmentId: string | null;
  /** The exact words the family saw and sent. */
  words: string;
  sentAt: IsoTime;
  readAt: IsoTime | null;
  readBy: string | null;
}

/** A person talked with the family about a custody or health yes, so the child's first lesson can go ahead. Nothing edits it. */
export interface TalkRecord {
  id: string;
  familyId: string;
  childRecordId: string;
  talkedAt: IsoTime;
  talkedBy: string;
}

export interface Counter {
  id: "child-serial" | "processor-ref";
  next: number;
}

/** Sandbox only: who this phone is playing. */
export interface DeviceState {
  id: string;
  role: "parent" | "moving" | "owner";
  currentFamilyId: string | null;
}

export interface Rows {
  pools: Pool;
  lessonTypes: LessonType;
  classes: SwimClass;
  evaluationTimes: EvaluationTime;
  families: Family;
  children: Child;
  listedAdults: ListedAdult;
  messageOnlyAdults: MessageOnlyAdult;
  emergencyContacts: EmergencyContact;
  enrollments: Enrollment;
  waitlistEntries: WaitlistEntry;
  signUpDrafts: SignUpDraft;
  releaseVersions: ReleaseVersion;
  releaseSignatures: ReleaseSignature;
  coverages: Coverage;
  consents: Consent;
  paymentMethods: PaymentMethod;
  bankDraftAuthorizations: BankDraftAuthorization;
  attendanceMarks: AttendanceMark;
  lessonNotes: LessonNote;
  coachLineTemplates: CoachLineTemplate;
  counters: Counter;
  deviceStates: DeviceState;
  closures: Closure;
  addDrafts: AddDraft;
  cancellations: Cancellation;
  owedLessons: OwedLesson;
  waitlistOffers: WaitlistOffer;
  familyNotes: FamilyNote;
  talkRecords: TalkRecord;
  fillIns: FillIn;
}

export type CollectionName = keyof Rows;

export const COLLECTIONS: readonly CollectionName[] = [
  "pools",
  "lessonTypes",
  "classes",
  "evaluationTimes",
  "families",
  "children",
  "listedAdults",
  "messageOnlyAdults",
  "emergencyContacts",
  "enrollments",
  "waitlistEntries",
  "signUpDrafts",
  "releaseVersions",
  "releaseSignatures",
  "coverages",
  "consents",
  "paymentMethods",
  "bankDraftAuthorizations",
  "attendanceMarks",
  "lessonNotes",
  "coachLineTemplates",
  "counters",
  "deviceStates",
  "closures",
  "addDrafts",
  "cancellations",
  "owedLessons",
  "waitlistOffers",
  "familyNotes",
  "talkRecords",
  "fillIns",
];

/** Add and list only: no edit, no delete. Only the sandbox erase wipes them. */
export const APPEND_ONLY = ["releaseSignatures", "coverages", "consents", "bankDraftAuthorizations"] as const;
export type AppendOnlyName = (typeof APPEND_ONLY)[number];
export type EditableName = Exclude<CollectionName, AppendOnlyName>;

export type AppData = { [K in CollectionName]: Rows[K][] };

export function emptyData(): AppData {
  return Object.fromEntries(COLLECTIONS.map((c) => [c, []])) as unknown as AppData;
}

/*
  The records the parent's path uses. Later rooms' records are listed in
  CLAUDE.md, not here.

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
  createdAt: IsoTime;
}

/** The waitlist for a full class, or (classId null) for any time that fits at the pool. A person makes every offer. */
export interface WaitlistEntry {
  id: string;
  familyId: string;
  childRecordId: string;
  poolId: string;
  classId: string | null;
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
export interface Coverage {
  id: string;
  familyId: string;
  signatureId: string;
  versionId: string;
  childRecordId: string;
  addedAt: IsoTime;
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
];

/** Add and list only: no edit, no delete. Only the sandbox erase wipes them. */
export const APPEND_ONLY = ["releaseSignatures", "coverages", "consents", "bankDraftAuthorizations"] as const;
export type AppendOnlyName = (typeof APPEND_ONLY)[number];
export type EditableName = Exclude<CollectionName, AppendOnlyName>;

export type AppData = { [K in CollectionName]: Rows[K][] };

export function emptyData(): AppData {
  return Object.fromEntries(COLLECTIONS.map((c) => [c, []])) as unknown as AppData;
}

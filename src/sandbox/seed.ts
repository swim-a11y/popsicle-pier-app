/*
  The starting sample. Made-up families, classes and prices. Fixed ids.
  Change SEED_VERSION whenever this file changes: phones holding an older
  seed wipe and reseed on their next visit.
*/
import { CONSENT_WORDING_VERSION, consentWords, RELEASE_V1, RELEASE_V2 } from "@/content/release";
import {
  emptyData,
  type AppData,
  type Child,
  type ConsentRecord,
  type Enrollment,
  type Family,
  type ReleaseSignature,
  type ReleaseVersion,
  type SwimClass,
} from "@/data/types";
import { sha256Hex } from "@/lib/sha256";
import { COACH_LINE_TEMPLATES } from "@/sandbox/coach-lines";
import { buildReleaseView, EIGHT_GROUPS, releaseViewText } from "@/rules/release";

export const SEED_VERSION = "2026-10-30.5";

/** Fingerprints of the published text. Pasted, not computed, so a text change breaks the fingerprint test. */
export const PUBLISHED_FINGERPRINTS = {
  v1: "d6c49c834fca155569a9cb391842f377bd7061e1b0d4060f8816a1814262f776",
  v2: "2c6c419f9c6c72f08e15e0d49f6879ec8b9d90d01a512f8c285e1363f328a5ed",
};

const SEEDED_AT = "2026-10-01T12:00:00.000Z";

export const MADISON = "pool-madison";
export const BUCKHEAD = "pool-buckhead";
export const MOVING_FAMILY_ID = "family-whitcombe";

function releaseVersions(): ReleaseVersion[] {
  return [
    {
      id: "v1",
      number: 1,
      publishedOn: "2026-03-01",
      isCurrent: false,
      whatChanged: [
        "First version of the family release.",
        "Seven groups, each with its own box.",
        "Two choices for each child: research and our posts.",
      ],
      groups: RELEASE_V1.groups,
      choices: RELEASE_V1.choices,
      fingerprint: PUBLISHED_FINGERPRINTS.v1,
    },
    {
      id: "v2",
      number: 2,
      publishedOn: "2026-09-15",
      isCurrent: true,
      whatChanged: [
        "Added \"AI review and our tools\".",
        "Recording now names adults on deck or in the water.",
        "Added the underwater images choice for each child.",
      ],
      groups: RELEASE_V2.groups,
      choices: RELEASE_V2.choices,
      fingerprint: PUBLISHED_FINGERPRINTS.v2,
    },
  ];
}

const classSeeds: Omit<SwimClass, "slotMinutes" | "lessonMinutes">[] = [
  // Madison
  { id: "mad-sun-0900-water", poolId: MADISON, lessonTypeId: "lt-mad-private", stageId: null, minAgeMonths: 24, maxAgeMonths: 35, weekday: 0, startTime: "09:00", instructorFirstName: "Marisol", capacity: 1, openSpots: 1, parentInWater: true },
  { id: "mad-sun-0930-pier", poolId: MADISON, lessonTypeId: "lt-mad-semi", stageId: "pier", minAgeMonths: 36, maxAgeMonths: 71, weekday: 0, startTime: "09:30", instructorFirstName: "Dev", capacity: 2, openSpots: 2, parentInWater: false },
  { id: "mad-sun-1000-shallows", poolId: MADISON, lessonTypeId: "lt-mad-semi", stageId: "shallows", minAgeMonths: 36, maxAgeMonths: 83, weekday: 0, startTime: "10:00", instructorFirstName: "Dev", capacity: 2, openSpots: 2, parentInWater: false },
  { id: "mad-wed-1630-shallows", poolId: MADISON, lessonTypeId: "lt-mad-semi", stageId: "shallows", minAgeMonths: 48, maxAgeMonths: 95, weekday: 3, startTime: "16:30", instructorFirstName: "Tamsin", capacity: 2, openSpots: 0, parentInWater: false },
  { id: "mad-wed-1700-cove", poolId: MADISON, lessonTypeId: "lt-mad-semi", stageId: "cove", minAgeMonths: 60, maxAgeMonths: 119, weekday: 3, startTime: "17:00", instructorFirstName: "Tamsin", capacity: 2, openSpots: 1, parentInWater: false },
  // Buckhead (opens Sunday, November 8, 2026)
  { id: "buc-sun-0900-water", poolId: BUCKHEAD, lessonTypeId: "lt-buc-private", stageId: null, minAgeMonths: 30, maxAgeMonths: 35, weekday: 0, startTime: "09:00", instructorFirstName: "Ines", capacity: 1, openSpots: 1, parentInWater: true },
  { id: "buc-sun-0900-cove", poolId: BUCKHEAD, lessonTypeId: "lt-buc-semi", stageId: "cove", minAgeMonths: 60, maxAgeMonths: 107, weekday: 0, startTime: "09:00", instructorFirstName: "Wren", capacity: 2, openSpots: 0, parentInWater: false },
  { id: "buc-sun-0930-pier", poolId: BUCKHEAD, lessonTypeId: "lt-buc-semi", stageId: "pier", minAgeMonths: 36, maxAgeMonths: 71, weekday: 0, startTime: "09:30", instructorFirstName: "Wren", capacity: 2, openSpots: 2, parentInWater: false },
  { id: "buc-sun-1000-cove", poolId: BUCKHEAD, lessonTypeId: "lt-buc-semi", stageId: "cove", minAgeMonths: 60, maxAgeMonths: 107, weekday: 0, startTime: "10:00", instructorFirstName: "Ines", capacity: 2, openSpots: 2, parentInWater: false },
];

function family(id: string, parentFullName: string, email: string, phone: string, homePoolId: string, source: Family["source"]): Family {
  return {
    id,
    createdAt: SEEDED_AT,
    homePoolId,
    parentFullName,
    email,
    phone,
    confirmedEmail: source === "sample" ? email : null,
    emailConfirmedAt: source === "sample" ? SEEDED_AT : null,
    heardFrom: null,
    source,
    movedOverAt: null,
    movingOverChecks: [],
  };
}

function child(id: string, familyId: string, firstName: string, birthDate: string, childId: string, stageId: Child["stageId"]): Child {
  return { id, familyId, firstName, birthDate, childId, stageId, flaggedForPerson: false, createdAt: SEEDED_AT };
}

function enrollment(id: string, f: string, c: string, classId: string, lessonTypeId: string, poolId: string, firstLessonDate: string, unpairedSince: string | null = null): Enrollment {
  return { id, familyId: f, childRecordId: c, kind: "class", poolId, timeId: classId, lessonTypeId, firstLessonDate, unpairedSince, createdAt: SEEDED_AT };
}

/** A signature for a seeded sample family: all boxes, no choices, signed online. */
function sampleSignature(id: string, f: Family, version: ReleaseVersion, kids: Child[], signedAt: string, schoolEmail: string): ReleaseSignature {
  const view = buildReleaseView(version, kids.map((k) => ({ key: k.id, firstName: k.firstName })), schoolEmail);
  const consents: ConsentRecord[] = [
    ...kids.flatMap((k) =>
      version.choices.map((ch) => ({
        kind: ch.key,
        childRecordId: k.id,
        given: false,
        words: consentWords(ch.key, version.choices, k.firstName, schoolEmail),
        wordingVersion: `release-${version.id}`,
      })),
    ),
    ...(["texts", "newsletter", "marketing-emails"] as const).map((kind) => ({
      kind,
      childRecordId: null,
      given: false,
      words: consentWords(kind, version.choices),
      wordingVersion: CONSENT_WORDING_VERSION,
    })),
  ];
  return {
    id,
    familyId: f.id,
    versionId: version.id,
    typedName: f.parentFullName,
    groupsAgreed: Object.fromEntries(EIGHT_GROUPS.map((g) => [g.key, version.groups.some((vg) => vg.key === g.key)])) as ReleaseSignature["groupsAgreed"],
    children: kids.map((k) => ({
      childRecordId: k.id,
      firstName: k.firstName,
      childId: k.childId,
      custodyYes: false,
      healthYes: false,
      choices: { research: false, marketing: false, underwater: false },
    })),
    childIds: kids.map((k) => k.childId!).filter(Boolean),
    textSha256: sha256Hex(releaseViewText(view)),
    signedAt,
    signedHow: "online",
    confirmedEmail: f.email,
    browserName: "Safari",
    agreedToSignElectronically: true,
    consents,
  };
}

export function buildSeed(): AppData {
  const data = emptyData();
  const versions = releaseVersions();
  const [v1, v2] = versions;

  data.pools.push(
    {
      id: MADISON,
      name: "Madison",
      youngestAgeMonths: 24,
      swimmersPerLesson: [1, 2],
      opensOn: null,
      schoolEmail: "madison.sample@example.com",
      firstLesson: {
        atAGlance: { park: "Side lot, swim family spots", bring: "Swimsuit, towel, warm layer" },
        address: "100 Example Way, Madison",
        parking: "Park in the side lot, in the spots marked for swim families.",
        door: "Come in through the blue side door by that lot.",
        arrive: "Arrive 10 minutes early so there's time to check in.",
        waitOnDeck: "Wait on the benches by the shallow end.",
        bring: ["A swimsuit, worn under clothes", "A towel", "Goggles, only if your swimmer already uses them", "A warm layer for after"],
      },
    },
    {
      id: BUCKHEAD,
      name: "Buckhead",
      youngestAgeMonths: 30,
      swimmersPerLesson: [1, 2],
      opensOn: "2026-11-08",
      schoolEmail: "buckhead.sample@example.com",
      firstLesson: {
        atAGlance: { park: "Front lot, rows A to C", bring: "Swimsuit, towel, flip-flops" },
        address: "200 Example Way, Buckhead",
        parking: "Park in the front lot. Rows A to C are closest to the pool.",
        door: "Use the main entrance and follow the pool signs.",
        arrive: "Arrive 15 minutes early on your first visit.",
        waitOnDeck: "Wait on deck in the family seats by the windows.",
        bring: ["A swimsuit", "A towel", "Flip-flops for the deck", "A warm layer for after"],
      },
    },
  );

  data.lessonTypes.push(
    { id: "lt-mad-private", poolId: MADISON, kind: "private", name: "Private", maxSwimmers: 1, bankDraftCents: 4600 },
    { id: "lt-mad-semi", poolId: MADISON, kind: "semi-private", name: "Semi-private", maxSwimmers: 2, bankDraftCents: 3400 },
    { id: "lt-buc-private", poolId: BUCKHEAD, kind: "private", name: "Private", maxSwimmers: 1, bankDraftCents: 4800 },
    { id: "lt-buc-semi", poolId: BUCKHEAD, kind: "semi-private", name: "Semi-private", maxSwimmers: 2, bankDraftCents: 3600 },
  );

  for (const c of classSeeds) data.classes.push({ ...c, slotMinutes: 30, lessonMinutes: 27 });

  data.evaluationTimes.push(
    // One child per free evaluation: private, so an under-3 never shares one.
    { id: "mad-eval-sun-1100", poolId: MADISON, weekday: 0, startTime: "11:00", slotMinutes: 30, lessonMinutes: 27, instructorFirstName: "Dev", capacity: 1, openSpots: 1 },
    { id: "mad-eval-sun-1130", poolId: MADISON, weekday: 0, startTime: "11:30", slotMinutes: 30, lessonMinutes: 27, instructorFirstName: "Dev", capacity: 1, openSpots: 1 },
    { id: "mad-eval-thu-1600", poolId: MADISON, weekday: 4, startTime: "16:00", slotMinutes: 30, lessonMinutes: 27, instructorFirstName: "Tamsin", capacity: 1, openSpots: 1 },
    { id: "buc-eval-sun-1100", poolId: BUCKHEAD, weekday: 0, startTime: "11:00", slotMinutes: 30, lessonMinutes: 27, instructorFirstName: "Ines", capacity: 1, openSpots: 1 },
    { id: "buc-eval-sun-1130", poolId: BUCKHEAD, weekday: 0, startTime: "11:30", slotMinutes: 30, lessonMinutes: 27, instructorFirstName: "Wren", capacity: 1, openSpots: 1 },
  );

  data.releaseVersions.push(...versions);
  data.coachLineTemplates.push(...COACH_LINE_TEMPLATES);

  // The family moving over from the old system: seeded directly, never an import file.
  // One parent, both emergency contacts, two children at Madison in their current
  // classes and prices, one listed adult Waiting, nothing signed here, no bank linked.
  const moving = family(MOVING_FAMILY_ID, "Dana Whitcombe", "dana.whitcombe@example.com", "404-555-0148", MADISON, "moving-over");
  const juniper = child("child-juniper", moving.id, "Juniper", "2021-06-14", "PP25-0031", "shallows");
  const theo = child("child-theo", moving.id, "Theo", "2019-03-02", "PP24-0017", "cove");
  data.families.push(moving);
  data.children.push(juniper, theo);
  data.emergencyContacts.push(
    { id: "contact-whitcombe-1", familyId: moving.id, name: "Morgan Whitcombe", phone: "404-555-0161", order: 1, createdAt: SEEDED_AT },
    { id: "contact-whitcombe-2", familyId: moving.id, name: "Pat Ellery", phone: "404-555-0174", order: 2, createdAt: SEEDED_AT },
  );
  data.listedAdults.push({
    id: "adult-whitcombe-bea",
    familyId: moving.id,
    firstName: "Bea",
    relationship: "grandparent",
    isParentOrGuardian: false,
    status: "waiting",
    signedHow: null,
    signedAt: null,
    createdAt: SEEDED_AT,
  });
  data.enrollments.push(
    enrollment("enr-juniper", moving.id, juniper.id, "mad-wed-1630-shallows", "lt-mad-semi", MADISON, "2025-09-03"),
    // The semi-private class with one child and one open spot.
    enrollment("enr-theo", moving.id, theo.id, "mad-wed-1700-cove", "lt-mad-semi", MADISON, "2024-09-04", "2026-10-07"),
  );

  // Sample families who signed earlier (owner counts; they also hold the full classes' spots).
  const marlow = family("family-marlow", "Lee Marlow", "lee.marlow@example.com", "404-555-0102", MADISON, "sample");
  const ari = child("child-ari", marlow.id, "Ari", "2021-02-20", "PP25-0034", "shallows");
  const ibarra = family("family-ibarra", "Sam Ibarra", "sam.ibarra@example.com", "404-555-0107", BUCKHEAD, "sample");
  const noor = child("child-noor", ibarra.id, "Noor", "2019-08-09", "PP26-0038", "cove");
  const sol = child("child-sol", ibarra.id, "Sol", "2020-01-15", "PP26-0039", "cove");
  const penhale = family("family-penhale", "Jo Penhale", "jo.penhale@example.com", "404-555-0113", MADISON, "sample");
  const kit = child("child-kit", penhale.id, "Kit", "2020-11-30", "PP26-0040", "pier");
  const tolliver = family("family-tolliver", "Rae Tolliver", "rae.tolliver@example.com", "404-555-0119", MADISON, "sample");
  const rio = child("child-rio", tolliver.id, "Rio", "2022-04-03", "PP26-0041", "pier");
  data.families.push(marlow, ibarra, penhale, tolliver);
  data.children.push(ari, noor, sol, kit, rio);
  data.enrollments.push(
    enrollment("enr-ari", marlow.id, ari.id, "mad-wed-1630-shallows", "lt-mad-semi", MADISON, "2025-10-01"),
    enrollment("enr-noor", ibarra.id, noor.id, "buc-sun-0900-cove", "lt-buc-semi", BUCKHEAD, "2026-11-08"),
    enrollment("enr-sol", ibarra.id, sol.id, "buc-sun-0900-cove", "lt-buc-semi", BUCKHEAD, "2026-11-08"),
  );
  const signatures = [
    sampleSignature("signature-marlow-v1", marlow, v1, [ari], "2026-04-12T15:20:00.000Z", "madison.sample@example.com"),
    sampleSignature("signature-penhale-v1", penhale, v1, [kit], "2026-05-20T16:45:00.000Z", "madison.sample@example.com"),
    sampleSignature("signature-tolliver-v2", tolliver, v2, [rio], "2026-09-28T12:10:00.000Z", "madison.sample@example.com"),
    sampleSignature("signature-ibarra-v2", ibarra, v2, [noor, sol], "2026-10-02T13:05:00.000Z", "buckhead.sample@example.com"),
  ];
  data.releaseSignatures.push(...signatures);
  for (const s of signatures) {
    s.consents.forEach((c, i) => data.consents.push({ ...c, id: `${s.id}-consent-${i + 1}`, familyId: s.familyId, signatureId: s.id, at: s.signedAt }));
  }

  // One counter across both pools. Serials 0032, 0033 and 0035 to 0037 belonged to
  // children who have left; they are never reused. The next new child is PP26-0042.
  data.counters.push({ id: "child-serial", next: 42 }, { id: "processor-ref", next: 1 });
  data.deviceStates.push({ id: "this-phone", role: "parent", currentFamilyId: null });
  return data;
}

import React from "react";

import { setStoreForTests } from "@/data/app-store";
import { LocalStore, type StorageLike } from "@/data/store";
import { buildSeed, SEED_VERSION } from "@/sandbox/seed";
import type { AppData } from "@/data/types";

export const pushes: string[] = [];

/*
  next/navigation and next/link stand-ins for rendering screens outside Next.
  Each render test file calls, at its top level:
    vi.mock("next/navigation", async () => (await import("./helpers")).navigationMock());
    vi.mock("next/link", async () => (await import("./helpers")).linkMock());
*/
export function navigationMock() {
  return {
    useRouter: () => ({ push: (h: string) => pushes.push(h), replace: (h: string) => pushes.push(h), back: () => {} }),
    usePathname: () => (globalThis as { __pathname?: string }).__pathname ?? "/",
  };
}

export function linkMock() {
  return {
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => React.createElement("a", { href, ...rest }, children),
  };
}

export function setPathname(pathname: string) {
  (globalThis as { __pathname?: string }).__pathname = pathname;
}

export function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

/** A fresh seeded store for one test, installed as the app's store. */
export function freshStore(edit?: (data: AppData) => void): LocalStore {
  const store = new LocalStore({
    seedVersion: SEED_VERSION,
    seed: () => {
      const data = buildSeed();
      edit?.(data);
      return data;
    },
    storage: memoryStorage(),
  });
  setStoreForTests(store);
  return store;
}

let n = 0;
export const testId = () => `test-id-${++n}`;

import type { DateOnly, SignUpDraft, StageId, Relationship } from "@/data/types";
import { emptyDraft, emptyDraftChild } from "@/rules/sign-up";
import { parseDate } from "@/rules/dates";
import { EIGHT_GROUPS } from "@/rules/release";
import { SAMPLE_CODE } from "@/sandbox/sample-code";

export const TODAY = "2026-10-30";
export const NOW = "2026-10-30T15:00:00.000Z";

export interface DraftKid {
  firstName: string;
  birth: DateOnly;
  stage: StageId | "evaluation";
  booking?: { kind: "class" | "evaluation"; timeId: string } | null;
  waitlist?: string[];
  custodyYes?: boolean;
  healthYes?: boolean;
  research?: boolean;
}

/** A sign-up draft with every step done, ready for signAndSave. */
export function completeDraft(opts: {
  poolId?: string;
  kids?: DraftKid[];
  payment?: "bank" | "card" | "hold" | "none";
  listed?: { firstName: string; relationship: Relationship }[];
  id?: string;
}): SignUpDraft {
  const d = emptyDraft(opts.id ?? "sign-up:this-phone", NOW);
  const kids = opts.kids ?? [{ firstName: "Mia", birth: "2022-07-30", stage: "shallows", booking: { kind: "class", timeId: "mad-sun-1000-shallows" } }];
  d.poolId = opts.poolId ?? "pool-madison";
  d.children = kids.map((k, i) => {
    const b = parseDate(k.birth);
    return {
      ...emptyDraftChild(`kid-${i + 1}`),
      firstName: k.firstName,
      birthMonth: String(b.m),
      birthDay: String(b.d),
      birthYear: String(b.y),
      stage: k.stage,
      booking: k.booking === undefined ? null : k.booking,
      waitlistClassIds: k.waitlist ?? [],
    };
  });
  d.fullName = "Jordan Sample";
  d.email = "jordan.sample@example.com";
  d.phone = "404-555-0123";
  d.codeSent = true;
  d.code = SAMPLE_CODE;
  d.confirmedEmail = d.email;
  d.heardFrom = "friend";
  d.contacts = [
    { name: "Casey Sample", phone: "404-555-0188" },
    { name: "Riley Sample", phone: "404-555-0199" },
  ];
  d.peopleDone = true;
  d.listedAdults = (opts.listed ?? []).map((a, i) => ({ key: `adult-${i}`, ...a }));
  d.justMe = (opts.listed ?? []).length === 0;
  const pay = opts.payment ?? "bank";
  d.payment =
    pay === "bank"
      ? { main: "bank", authorized: true, backupCard: true, holdCard: false }
      : pay === "card"
        ? { main: "card", authorized: false, backupCard: false, holdCard: false }
        : pay === "hold"
          ? { main: null, authorized: false, backupCard: false, holdCard: true }
          : { main: null, authorized: false, backupCard: false, holdCard: false };
  d.release = {
    groups: Object.fromEntries(EIGHT_GROUPS.map((g) => [g.key, true])),
    perChild: Object.fromEntries(
      d.children.map((c, i) => [
        c.key,
        {
          custody: kids[i].custodyYes ? "yes" : "no",
          health: kids[i].healthYes ? "yes" : "no",
          research: Boolean(kids[i].research),
          marketing: false,
          underwater: false,
        },
      ]),
    ),
    texts: false,
    newsletter: false,
    marketingEmails: false,
    typedName: "Jordan Sample",
    agreeElectronic: true,
  };
  return d;
}

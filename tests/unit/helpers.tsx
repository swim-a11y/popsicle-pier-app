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

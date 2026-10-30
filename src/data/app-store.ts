/*
  The app's one store. Created on first use, which only happens in an
  effect or event handler, so prerendering never touches storage.
*/
import { browserStorage, LocalStore } from "@/data/store";
import { emptyData } from "@/data/types";
import { SANDBOX } from "@/sandbox";
import { buildSeed, SEED_VERSION } from "@/sandbox/seed";

let store: LocalStore | null = null;

export function getStore(): LocalStore {
  if (!store) {
    store = new LocalStore({
      seedVersion: SANDBOX ? SEED_VERSION : "empty",
      seed: SANDBOX ? buildSeed : emptyData,
      storage: browserStorage(),
    });
  }
  return store;
}

/** Tests swap in their own store. */
export function setStoreForTests(next: LocalStore | null): void {
  store = next;
}

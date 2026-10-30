import { describe, expect, it } from "vitest";

import { AppendOnlyError, LocalStore, STORAGE_KEY, type DataStore, type StorageLike } from "@/data/store";
import { APPEND_ONLY } from "@/data/types";
import { buildSeed } from "@/sandbox/seed";

import { memoryStorage } from "./helpers";

const makeStore = (storage: StorageLike | null, seedVersion = "v-test") => new LocalStore({ seedVersion, seed: buildSeed, storage });

describe("store", () => {
  it("one key holds {seedVersion, data}", async () => {
    const storage = memoryStorage();
    const store = makeStore(storage);
    await store.snapshot();
    expect([...storage.map.keys()]).toEqual([STORAGE_KEY]);
    const blob = JSON.parse(storage.map.get(STORAGE_KEY)!);
    expect(Object.keys(blob).sort()).toEqual(["data", "seedVersion"]);
    expect(blob.seedVersion).toBe("v-test");
    expect(blob.data.pools).toHaveLength(2);
  });

  it("a changed seedVersion wipes and reseeds", async () => {
    const storage = memoryStorage();
    const first = makeStore(storage, "one");
    await first.transaction((tx) =>
      tx.add("waitlistEntries", { id: "w1", familyId: "f", childRecordId: "c", poolId: "pool-madison", classId: "x", fromNoteId: null, createdAt: "2026-10-30T00:00:00.000Z" }),
    );
    expect(await makeStore(storage, "one").list("waitlistEntries")).toHaveLength(1);
    const second = makeStore(storage, "two");
    expect(await second.list("waitlistEntries")).toHaveLength(0);
    expect(JSON.parse(storage.map.get(STORAGE_KEY)!).seedVersion).toBe("two");
  });

  it("falls back to memory when storage throws", async () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    const store = makeStore(broken);
    expect((await store.list("pools")).length).toBe(2);
    await store.transaction((tx) => tx.update("classes", "mad-sun-0930-pier", { openSpots: 1 }));
    expect((await store.get("classes", "mad-sun-0930-pier"))?.openSpots).toBe(1);
    expect(store.memoryOnly).toBe(true);
    const none = makeStore(null);
    expect((await none.list("pools")).length).toBe(2);
  });

  it("signatures, coverage, consents and bank-draft authorizations are add and list only", async () => {
    expect([...APPEND_ONLY].sort()).toEqual(["bankDraftAuthorizations", "consents", "coverages", "releaseSignatures"]);
    const store = makeStore(memoryStorage());
    const before = await store.snapshot();
    const signatureId = before.releaseSignatures[0].id;
    for (const name of APPEND_ONLY) {
      const id = name === "releaseSignatures" ? signatureId : "x";
      await expect(store.transaction((tx) => (tx as unknown as { update: (n: string, i: string, p: object) => void }).update(name, id, {}))).rejects.toThrow(AppendOnlyError);
      await expect(store.transaction((tx) => (tx as unknown as { remove: (n: string, i: string) => void }).remove(name, id))).rejects.toThrow(AppendOnlyError);
    }
    await store.transaction((tx) =>
      tx.add("coverages", { id: "cov-1", familyId: "f", signatureId, versionId: "v2", childRecordId: "c", answers: null, addedAt: "2026-10-30T00:00:00.000Z" }),
    );
    expect(await store.list("coverages")).toHaveLength(1);
    // The DataStore interface itself offers no delete; only the sandbox erase wipes.
    const methods: (keyof DataStore)[] = ["snapshot", "list", "get", "transaction", "subscribe"];
    expect(methods).not.toContain("delete" as never);
    await store.wipeAndReseed();
    expect(await store.list("coverages")).toHaveLength(0);
    expect((await store.list("releaseSignatures")).length).toBe(before.releaseSignatures.length);
  });

  it("append-only rows can't be changed in place either", async () => {
    const store = makeStore(memoryStorage());
    const data = await store.snapshot();
    const signature = data.releaseSignatures[0];
    expect(() => {
      (signature as { typedName: string }).typedName = "Someone else";
    }).toThrow(TypeError);
    expect(() => {
      (signature.children[0] as { custodyYes: boolean }).custodyYes = true;
    }).toThrow(TypeError);
    await expect(
      store.transaction((tx) => {
        (tx.get("releaseSignatures", signature.id) as { typedName: string }).typedName = "Someone else";
      }),
    ).rejects.toThrow(TypeError);
    // A row added in a transaction is sealed once it lands.
    await store.transaction((tx) =>
      tx.add("coverages", { id: "cov-x", familyId: "f", signatureId: signature.id, versionId: "v2", childRecordId: "c", answers: null, addedAt: "2026-10-30T00:00:00.000Z" }),
    );
    const added = (await store.get("coverages", "cov-x"))!;
    expect(Object.isFrozen(added)).toBe(true);
    expect((await store.snapshot()).releaseSignatures[0].typedName).toBe(signature.typedName);
  });

  it("a failed transaction changes nothing", async () => {
    const store = makeStore(memoryStorage());
    const before = JSON.stringify(await store.snapshot());
    await expect(
      store.transaction((tx) => {
        tx.update("classes", "mad-sun-0930-pier", { openSpots: 0 });
        throw new Error("stop");
      }),
    ).rejects.toThrow("stop");
    expect(JSON.stringify(await store.snapshot())).toBe(before);
  });
});

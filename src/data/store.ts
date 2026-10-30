/*
  The one data interface. Screens and rules talk to a DataStore; this build
  ships a localStorage store, and a Postgres adapter can implement the same
  interface later (snapshot reads, a transaction for writes).

  localStorage holds ONE key, {seedVersion, data}. A changed seedVersion wipes
  and reseeds. If storage throws (private mode, full, blocked), the store
  keeps working in memory for this visit.
*/

import {
  APPEND_ONLY,
  COLLECTIONS,
  type AppData,
  type AppendOnlyName,
  type CollectionName,
  type EditableName,
  type Rows,
} from "@/data/types";

export const STORAGE_KEY = "popsicle-pier-sample-app";

export interface StoredBlob {
  seedVersion: string;
  data: AppData;
}

/** Reads inside a transaction see the transaction's own writes. */
export interface Transaction {
  data(): Readonly<AppData>;
  list<K extends CollectionName>(name: K): readonly Rows[K][];
  get<K extends CollectionName>(name: K, id: string): Rows[K] | undefined;
  add<K extends CollectionName>(name: K, row: Rows[K]): Rows[K];
  update<K extends EditableName>(name: K, id: string, patch: Partial<Rows[K]>): Rows[K];
  remove<K extends EditableName>(name: K, id: string): void;
}

export interface DataStore {
  /** Everything, read-only. */
  snapshot(): Promise<Readonly<AppData>>;
  list<K extends CollectionName>(name: K): Promise<readonly Rows[K][]>;
  get<K extends CollectionName>(name: K, id: string): Promise<Rows[K] | undefined>;
  /** Several writes as one: all of them land or none do. */
  transaction<T>(work: (tx: Transaction) => T): Promise<T>;
  /** Called after every committed transaction. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

export class AppendOnlyError extends Error {
  constructor(name: string, action: string) {
    super(`${name} are add and list only; ${action} is not allowed.`);
    this.name = "AppendOnlyError";
  }
}

export function isAppendOnly(name: CollectionName): name is AppendOnlyName {
  return (APPEND_ONLY as readonly string[]).includes(name);
}

/** The slice of the Web Storage API the store uses. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function browserStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function makeTransaction(working: AppData): Transaction {
  const rows = <K extends CollectionName>(name: K) => working[name] as Rows[K][];
  return {
    data: () => working,
    list: (name) => rows(name),
    get: (name, id) => rows(name).find((r) => (r as { id: string }).id === id),
    add(name, row) {
      const id = (row as { id: string }).id;
      if (!id) throw new Error(`A ${name} row needs an id.`);
      if (rows(name).some((r) => (r as { id: string }).id === id)) throw new Error(`${name} already has ${id}.`);
      rows(name).push(row);
      return row;
    },
    update(name, id, patch) {
      if (isAppendOnly(name)) throw new AppendOnlyError(name, "edit");
      const list = rows(name);
      const at = list.findIndex((r) => (r as { id: string }).id === id);
      if (at < 0) throw new Error(`${name} has no ${id}.`);
      const next = { ...list[at], ...patch, id };
      list[at] = next;
      return next;
    },
    remove(name, id) {
      if (isAppendOnly(name)) throw new AppendOnlyError(name, "delete");
      const list = rows(name);
      const at = list.findIndex((r) => (r as { id: string }).id === id);
      if (at >= 0) list.splice(at, 1);
    },
  };
}

function normalize(data: Partial<AppData>): AppData {
  const out = {} as AppData;
  for (const c of COLLECTIONS) (out as Record<string, unknown[]>)[c] = Array.isArray(data[c]) ? [...(data[c] as unknown[])] : [];
  return out;
}

export interface LocalStoreOptions {
  seedVersion: string;
  seed: () => AppData;
  storage: StorageLike | null;
}

export class LocalStore implements DataStore {
  private data: AppData | null = null;
  private listeners = new Set<() => void>();
  /** True once storage has failed; the store then lives in memory only. */
  memoryOnly = false;

  constructor(private readonly options: LocalStoreOptions) {}

  private load(): AppData {
    if (this.data) return this.data;
    const { storage, seedVersion } = this.options;
    if (storage) {
      try {
        const raw = storage.getItem(STORAGE_KEY);
        if (raw) {
          const blob = JSON.parse(raw) as StoredBlob;
          if (blob && blob.seedVersion === seedVersion && blob.data) {
            this.data = normalize(blob.data);
            return this.data;
          }
        }
      } catch {
        this.memoryOnly = true;
      }
    } else {
      this.memoryOnly = true;
    }
    // Nothing stored, a different seedVersion, or unreadable: wipe and reseed.
    this.data = normalize(this.options.seed());
    this.persist();
    return this.data;
  }

  private persist() {
    const { storage, seedVersion } = this.options;
    if (!storage || !this.data) {
      this.memoryOnly = true;
      return;
    }
    try {
      const blob: StoredBlob = { seedVersion, data: this.data };
      storage.setItem(STORAGE_KEY, JSON.stringify(blob));
    } catch {
      this.memoryOnly = true;
    }
  }

  private emit() {
    for (const l of [...this.listeners]) l();
  }

  async snapshot(): Promise<Readonly<AppData>> {
    return this.load();
  }

  async list<K extends CollectionName>(name: K): Promise<readonly Rows[K][]> {
    return this.load()[name] as Rows[K][];
  }

  async get<K extends CollectionName>(name: K, id: string): Promise<Rows[K] | undefined> {
    return (this.load()[name] as Rows[K][]).find((r) => (r as { id: string }).id === id);
  }

  async transaction<T>(work: (tx: Transaction) => T): Promise<T> {
    const working = structuredClone(this.load());
    const result = work(makeTransaction(working));
    if (result instanceof Promise) throw new Error("Transactions run synchronously so they land all at once.");
    this.data = working;
    this.persist();
    this.emit();
    return result;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Sandbox erase only: wipes everything on this phone and puts the starting sample back. */
  async wipeAndReseed(): Promise<void> {
    const { storage } = this.options;
    try {
      storage?.removeItem(STORAGE_KEY);
    } catch {
      this.memoryOnly = true;
    }
    this.data = normalize(this.options.seed());
    this.persist();
    this.emit();
  }
}

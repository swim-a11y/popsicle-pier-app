"use client";

import { useEffect, useState } from "react";

import { getStore } from "@/data/app-store";
import type { AppData } from "@/data/types";
import { todayAtSchool } from "@/rules/dates";

export interface Loaded {
  data: Readonly<AppData>;
  /** Today at the school, read once the screen has mounted. */
  today: string;
}

/**
 * Stored data plus today's date, or null until the screen has mounted and
 * the data has loaded. Screens show skeleton rows while it's null.
 */
export function useAppData(): Loaded | null {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    const store = getStore();
    let alive = true;
    const read = () => {
      store.snapshot().then((data) => {
        if (alive) setLoaded({ data, today: todayAtSchool(new Date()) });
      });
    };
    read();
    const unsubscribe = store.subscribe(read);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);
  return loaded;
}

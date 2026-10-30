/*
  Closed days. A person sets them (the Schedule room); families see them.
  A closed day has no lesson and isn't billed. Lesson dates skip it.
*/
import type { AppData, Closure, DateOnly } from "@/data/types";

export function closedDates(data: Readonly<AppData>, poolId: string): DateOnly[] {
  return data.closures.filter((c) => c.poolId === poolId).map((c) => c.date);
}

export function closureOn(data: Readonly<AppData>, poolId: string, date: DateOnly): Closure | undefined {
  return data.closures.find((c) => c.poolId === poolId && c.date === date);
}

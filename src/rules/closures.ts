/*
  Days without a lesson. A closed day (a person sets it, the Schedule room)
  has no lesson and isn't billed. A class date the school cancels has no
  lesson either, but that lesson is owed to each child in it. New lesson
  dates skip both.
*/
import type { AppData, Cancellation, Closure, DateOnly, Pool, SwimClass } from "@/data/types";
import { addDays, firstOpenLessonDate } from "@/rules/dates";
import { datesFullOfOneOffs } from "@/rules/holds";

export function closedDates(data: Readonly<AppData>, poolId: string): DateOnly[] {
  return data.closures.filter((c) => c.poolId === poolId).map((c) => c.date);
}

export function closureOn(data: Readonly<AppData>, poolId: string, date: DateOnly): Closure | undefined {
  return data.closures.find((c) => c.poolId === poolId && c.date === date);
}

export function cancelledDates(data: Readonly<AppData>, classId: string): DateOnly[] {
  return data.cancellations.filter((c) => c.classId === classId).map((c) => c.date);
}

export function cancellationOn(data: Readonly<AppData>, classId: string, date: DateOnly): Cancellation | undefined {
  return data.cancellations.find((c) => c.classId === classId && c.date === date);
}

/**
 * A new weekly booking's first lesson in this class: never a closed or
 * cancelled day, and after the last date that owed lessons and fill-ins
 * already fill, so the weekly lessons never run through one.
 */
export function firstWeeklyDate(data: Readonly<AppData>, cls: Pick<SwimClass, "id" | "poolId" | "openSpots" | "weekday">, pool: Pick<Pool, "opensOn">, today: DateOnly): DateOnly {
  const full = datesFullOfOneOffs(data, cls, today).sort();
  let opens = pool.opensOn;
  const after = full.length > 0 ? addDays(full[full.length - 1], 1) : null;
  if (after && (!opens || after > opens)) opens = after;
  return firstOpenLessonDate(cls.weekday, today, opens, [...closedDates(data, cls.poolId), ...cancelledDates(data, cls.id)]);
}

/*
  Days without a lesson. A closed day (a person sets it, the Schedule room)
  has no lesson and isn't billed. A class date the school cancels has no
  lesson either, but that lesson is owed to each child in it. New lesson
  dates skip both.
*/
import type { AppData, Cancellation, Closure, DateOnly, SwimClass } from "@/data/types";
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

/** Dates a new weekly booking in this class skips: closed days, cancelled dates, and dates owed lessons fill. */
export function skippedDates(data: Readonly<AppData>, cls: Pick<SwimClass, "id" | "poolId" | "openSpots">, today: DateOnly): DateOnly[] {
  return [...closedDates(data, cls.poolId), ...cancelledDates(data, cls.id), ...datesFullOfOneOffs(data, cls, today)];
}

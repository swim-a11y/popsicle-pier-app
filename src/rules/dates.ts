/*
  Dates and ages. Every function takes "today" (YYYY-MM-DD in New York) as
  an argument; only effects and event handlers read the clock.
*/
import type { DateOnly, IsoTime } from "@/data/types";

export const SCHOOL_TIME_ZONE = "America/New_York";
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Today's date at the school, from a clock reading. */
export function todayAtSchool(now: Date): DateOnly {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: SCHOOL_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function parseDate(d: DateOnly): { y: number; m: number; d: number } {
  const [y, m, day] = d.split("-").map(Number);
  return { y, m, d: day };
}

function toUtc(d: DateOnly): Date {
  const p = parseDate(d);
  return new Date(Date.UTC(p.y, p.m - 1, p.d));
}

function fromUtc(dt: Date): DateOnly {
  return dt.toISOString().slice(0, 10);
}

export function isValidDate(y: number, m: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (m < 1 || m > 12 || d < 1 || y < 1900 || y > 2100) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function makeDate(y: number, m: number, d: number): DateOnly {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function addDays(d: DateOnly, n: number): DateOnly {
  const dt = toUtc(d);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fromUtc(dt);
}

/** Same day of the month, n months later (clamped to the month's last day). */
export function addMonths(d: DateOnly, n: number): DateOnly {
  const p = parseDate(d);
  const first = new Date(Date.UTC(p.y, p.m - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return makeDate(first.getUTCFullYear(), first.getUTCMonth() + 1, Math.min(p.d, last));
}

export function weekdayOf(d: DateOnly): number {
  return toUtc(d).getUTCDay();
}

export function compareDates(a: DateOnly, b: DateOnly): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** "Every child 3 and under" wears a swim diaper: under 4 on the first lesson date. */
export const THREE_AND_UNDER_MONTHS = 48;

export function isThreeAndUnder(ageMonths: number): boolean {
  return ageMonths < THREE_AND_UNDER_MONTHS;
}

/** Whole months of age on a given day. */
export function ageInMonths(birth: DateOnly, on: DateOnly): number {
  const b = parseDate(birth);
  const o = parseDate(on);
  let months = (o.y - b.y) * 12 + (o.m - b.m);
  if (o.d < b.d) months -= 1;
  return months;
}

/**
 * The first lesson is the first class day at least 2 days after today, and
 * never before the pool opens (Buckhead: Sunday, November 8, 2026).
 */
export function firstLessonDate(weekday: number, today: DateOnly, opensOn: DateOnly | null): DateOnly {
  let start = addDays(today, 2);
  if (opensOn && compareDates(opensOn, start) > 0) start = opensOn;
  const offset = (weekday - weekdayOf(start) + 7) % 7;
  return addDays(start, offset);
}

/** The first lesson date that isn't a closed day: closed days are skipped, never booked. */
export function firstOpenLessonDate(weekday: number, today: DateOnly, opensOn: DateOnly | null, closed: readonly DateOnly[]): DateOnly {
  let d = firstLessonDate(weekday, today, opensOn);
  while (closed.includes(d)) d = addDays(d, 7);
  return d;
}

export function weekdayName(weekday: number): string {
  return WEEKDAYS[weekday];
}

/** "Sunday, November 8" (adds the year when it isn't this year's). */
export function longDate(d: DateOnly, today?: DateOnly): string {
  const p = parseDate(d);
  const base = `${WEEKDAYS[weekdayOf(d)]}, ${MONTHS[p.m - 1]} ${p.d}`;
  if (today && parseDate(today).y !== p.y) return `${base}, ${p.y}`;
  return base;
}

/** "November 8, 2026" */
export function monthDayYear(d: DateOnly): string {
  const p = parseDate(d);
  return `${MONTHS[p.m - 1]} ${p.d}, ${p.y}`;
}

/** "9:30 am" from "09:30". */
export function clockTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")}\u00a0${suffix}`;
}

export function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** A stored UTC time shown at the school: "October 30, 2026 at 11:02 am". */
export function shownAtSchool(iso: IsoTime): string {
  const dt = new Date(iso);
  const date = new Intl.DateTimeFormat("en-US", { timeZone: SCHOOL_TIME_ZONE, month: "long", day: "numeric", year: "numeric" }).format(dt);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: SCHOOL_TIME_ZONE, hour: "numeric", minute: "2-digit" })
    .format(dt)
    .replace("AM", "am")
    .replace("PM", "pm");
  return `${date} at ${time}`;
}

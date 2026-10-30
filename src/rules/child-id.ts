/*
  Child ID: "PP", the two-digit year of first booking, a hyphen and a
  four-digit serial from one counter shared by both pools (PP26-0042).
  Set the first time a child is booked (the free evaluation included),
  never reused, never changed. It says nothing about the child.
  Staff screens only: families never see it.
*/
import type { Transaction } from "@/data/store";
import type { DateOnly } from "@/data/types";
import { parseDate } from "@/rules/dates";

export const CHILD_ID_PATTERN = /\bPP\d{2}-\d{4}\b/;

export function formatChildId(year: number, serial: number): string {
  return `PP${String(year % 100).padStart(2, "0")}-${String(serial).padStart(4, "0")}`;
}

function nextFromCounter(tx: Transaction, id: "child-serial" | "processor-ref"): number {
  const counter = tx.get("counters", id);
  if (!counter) {
    tx.add("counters", { id, next: 2 });
    return 1;
  }
  tx.update("counters", id, { next: counter.next + 1 });
  return counter.next;
}

/** Gives the child an ID if they don't have one yet; returns the child's ID either way. */
export function ensureChildId(tx: Transaction, childRecordId: string, bookedOn: DateOnly): string {
  const child = tx.get("children", childRecordId);
  if (!child) throw new Error(`No child ${childRecordId}.`);
  if (child.childId) return child.childId;
  const childId = formatChildId(parseDate(bookedOn).y, nextFromCounter(tx, "child-serial"));
  tx.update("children", childRecordId, { childId });
  return childId;
}

/** Sandbox processor references, like SANDBOX-REF-0001. */
export function nextProcessorRef(tx: Transaction): string {
  return `SANDBOX-REF-${String(nextFromCounter(tx, "processor-ref")).padStart(4, "0")}`;
}

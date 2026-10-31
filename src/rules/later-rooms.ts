/*
  RULES FOR LATER ROOMS. Shown on the staff page. The words are the
  owner's, copied exactly; a test checks them against CLAUDE.md. Each rule
  names the room that will follow it. The owner's rulings of October 30
  and 31, 2026 built a few of them (bills, waitlist offers, owed lessons,
  fill-ins, the inbox, the note about a class with no partner); those say
  where (builtIn). The rest aren't built yet.
*/

export type RoomId = "schedule" | "deck" | "money" | "office-owner" | "progress-video" | "every-room";

export interface LaterRoom {
  id: string;
  name: string;
  line: string;
}

/** The rooms still to come, in the order the staff page lists them. */
export const LATER_ROOMS: readonly LaterRoom[] = [
  { id: "schedule", name: "Schedule", line: "Classes, lesson dates, closures, waitlists and owed lessons, all set by a person." },
  { id: "deck", name: "Deck", line: "Today's roster, a mark for every child at every lesson, notes and incidents." },
  { id: "money", name: "Money", line: "Bank draft first with a card price, monthly bills and drafts, and credits the owner approves." },
  { id: "office-owner", name: "Office and Owner", line: "One approvals inbox (in this sample now), the numbers, staff, release versions and the agents' log." },
  { id: "progress-video", name: "Progress and Video", line: "Each child's stage on the Path, the monthly note, clips and the family library." },
  { id: "workouts", name: "Workouts (a later wing)", line: "Workouts for swimmers who want more time in the water." },
  { id: "swim-team", name: "Swim team (a later wing)", line: "A path from lessons into a swim team." },
];

export interface LaterRoomRule {
  room: RoomId;
  text: string;
  /** Where this sample follows the rule already, after the owner's rulings. */
  builtIn?: string;
}

export const LATER_ROOM_RULES: readonly LaterRoomRule[] = [
  { room: "deck", text: "Being checked in at the pool is the attendance record. Families email absences (parent screens may say so)." },
  { room: "schedule", text: "A family's own miss gets a fill-in only: same instructor, the week after.", builtIn: "the inbox's notes from families, answered in Messages" },
  {
    room: "schedule",
    text: "A lesson the school cancels is made up with the child's own instructor within three weeks: one date offered, a week to answer, one more date, then it closes with no credit. A credit only when no opening exists, and only with the owner's approval.",
    builtIn: "the inbox's owed lessons, answered in Messages",
  },
  { room: "schedule", text: "Closed days are never billed and never made up.", builtIn: "Lesson dates and Bills" },
  { room: "office-owner", text: "A second no-show in a month goes to the owner as \"time for a talk\"." },
  { room: "deck", text: "Two missed lessons in a row, for any reason, draft a check-in note to the family; a person sends it." },
  {
    room: "deck",
    text: "No drop-off: a parent, guardian or signed listed adult stays the whole lesson, or it doesn't start. No instructor is ever alone with a child; with no other adult there, lessons stop.",
  },
  { room: "deck", text: "Until the insurer answers in writing, a lesson whose only adult isn't a parent or guardian waits for the owner's okay." },
  {
    room: "deck",
    text: "A health or custody yes holds that child's first lesson until a person has talked with the family. The roster shows a flag, never the details.",
    builtIn: "the inbox, in part: it lists each yes until a person has talked with the family; the roster comes later",
  },
  {
    room: "deck",
    text: "The attendance mark files the video: child ID, pool, date and slot, instructor, and the adult present and whether they're a parent or guardian. No clip reaches a family until its mark is confirmed.",
  },
  { room: "deck", text: "An incident holds that lesson's video: nothing is removed or deleted while it's open." },
  { room: "schedule", text: "Staff choose semi-private partners and who is invited to any class; agents only draft the note a person sends.", builtIn: "the inbox's waitlist offers" },
  {
    room: "money",
    text: "An unpaired semi-private child pays the semi-private price for the first month from the first lesson. If there's still no partner, the family hears at least three weeks before the price changes. The month starts again when a partner leaves.",
    builtIn: "the inbox's notes about a class with no partner, read in Messages; the price never changes on its own",
  },
  {
    room: "money",
    text: "A charge moves through scheduled, pending, settled, returned, refunded or disputed. A bill shows \"pending\" until the bank settles it, and a returned draft is still owed. What the processor charges the school is the school's cost, never a family's.",
  },
  {
    room: "money",
    text: "Each month's bill reaches the family by the 19th, at least 10 days before the draft on the 1st, with bank draft and card prices on every line.",
    builtIn: "Bills, lessons only",
  },
  {
    room: "money",
    text: "Fees live on the family: a yearly registration fee on the enrollment anniversary, capped per family; a quarterly per-family fee at one pool for families from outside its county; and a founding marker that lowers every lesson for every child in the family.",
  },
  { room: "money", text: "One pool shares a percent of collected lesson revenue with its facility, reported by the 15th; registration fees, refunds and chargebacks are left out." },
  {
    room: "money",
    text: "Every processor deposit breaks down into each family's charges, the processor's fees and the net, so the books match it line by line. The books live in the owner's own QuickBooks file and a CPA reviews them. Anything that reads the books sees money records only, never a child's record.",
  },
  {
    room: "office-owner",
    text: "Agents never answer about an injury, a refund, custody or a pickup change, a medical question, a scared child, a move to another class or stage, or a concern about how a child was treated; a person does.",
  },
  { room: "office-owner", text: "Live view is for the three school leaders only; nothing is ever streamed to families or the public." },
  {
    room: "office-owner",
    text: "Each instructor's record holds a signed acknowledgment of recording and live view, and lifeguard, CPR and background-check dates. The roster shows whether today's instructor holds a current lifeguard card.",
  },
  { room: "office-owner", text: "The owner's numbers count participants by pool for the insurer's year-end audit." },
  { room: "office-owner", text: "The owner's numbers show what payments cost the school each month, bank draft and card side by side, with the effective rate." },
  { room: "progress-video", text: "Families see their child's stage, never a tier, and never another child." },
  { room: "progress-video", text: "No facial recognition; clips matched by roster and slot; nothing sold." },
  { room: "every-room", text: "Agents draft and a person approves, in every room.", builtIn: "the inbox and Messages" },
];

export function rulesForRoom(room: RoomId): string[] {
  return LATER_ROOM_RULES.filter((r) => r.room === room).map((r) => r.text);
}

/** The rules for one room with where each is built already, if it is. */
export function ruleEntriesForRoom(room: RoomId): LaterRoomRule[] {
  return LATER_ROOM_RULES.filter((r) => r.room === room);
}

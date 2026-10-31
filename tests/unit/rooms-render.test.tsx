import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { completeDraft, freshStore, NOW, pushes, setPathname, testId, TODAY } from "./helpers";

vi.mock("next/navigation", async () => (await import("./helpers")).navigationMock());
vi.mock("next/link", async () => (await import("./helpers")).linkMock());

import { BillsScreen } from "@/components/screens/bills";
import { FirstLessonScreen } from "@/components/screens/first-lesson";
import { HomeScreen } from "@/components/screens/home";
import { InboxScreen } from "@/components/screens/inbox";
import { LessonDatesScreen } from "@/components/screens/lesson-dates";
import { MessagesScreen } from "@/components/screens/messages";
import { SendNoteScreen } from "@/components/screens/send-note";
import { StaffScreen } from "@/components/screens/staff";
import type { LocalStore } from "@/data/store";
import type { SignUpDraft } from "@/data/types";
import { bookTime, setCurrentFamily, signAndSave } from "@/rules/booking";
import { answerFillIn, sendFillIn } from "@/rules/fillins";
import { familyLessons } from "@/rules/family";
import { LATER_ROOM_RULES } from "@/rules/later-rooms";
import { markNoteRead, sendNote } from "@/rules/notes";
import { answerWaitlistOffer, leaveClass, leaveWaitlist, offerDifferentTime, sendWaitlistOffer, waitlistItems } from "@/rules/offers";
import { answerOwedOffer, cancelClassDate, owedState, sendOwedOffer } from "@/rules/owed";
import { sendPartnerNotice } from "@/rules/partners";
import { pretendFirstLesson } from "@/sandbox/pretend-first-lesson";
import { MOVING_FAMILY_ID } from "@/sandbox/seed";
import { pretendFamilyLeft, pretendSchoolCancelled } from "@/sandbox/pretend-school";

const flat = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW));
  pushes.length = 0;
  window.history.replaceState({}, "", "/");
  setPathname("/");
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function signUp(store: LocalStore, draft: SignUpDraft = completeDraft({})) {
  const saved = { ...draft, id: `draft-${testId()}` };
  return act(async () => {
    await store.transaction((tx) => tx.add("signUpDrafts", saved));
    return store.transaction((tx) => signAndSave(tx, { draft: saved, today: TODAY, now: NOW, browserName: "Chrome", newId: testId }));
  });
}

const adaDraft = () =>
  completeDraft({
    id: "draft-ada",
    poolId: "pool-buckhead",
    kids: [{ firstName: "Ada", birth: "2020-05-30", stage: "cove", booking: { kind: "class", timeId: "buc-sun-1000-cove" }, waitlist: ["buc-sun-0900-cove"], custodyYes: true }],
  });

describe("bills", () => {
  it("each month's lessons with both prices on every line, closed days not billed, nothing charged", async () => {
    const store = freshStore();
    await signUp(store);
    render(<BillsScreen />);
    const months = await screen.findAllByTestId("month-bill");
    expect(months).toHaveLength(2);
    const nov = within(months[0]);
    expect(nov.getByRole("heading", { name: "November" })).toBeInTheDocument();
    expect(flat(nov.getByTestId("bill-date").textContent)).toBe("Friday, October 30");
    expect(flat(nov.getByTestId("draft-date").textContent)).toBe("Tuesday, December 1");
    expect(flat(nov.getByTestId("billed-dates").textContent)).toBe("4 lessons: November 1, 8, 15 and 22");
    expect(flat(nov.getByTestId("not-billed").textContent)).toBe("November 29: Closed for the holiday weekend (sample). Not billed.");
    const prices = flat(nov.getByTestId("line-prices").textContent);
    expect(prices).toBe("Bank draft$136.00, 4 at $34.00Card$140.00, 4 at $35.00");
    expect(flat(nov.getByTestId("you-pay").textContent)).toBe("You pay $136.00 by bank draft, drafted on Tuesday, December 1.");
    // The first bill went out after the 19th, so it's drafted on the next 1st at least 10 days on, and says why.
    expect(nov.getByTestId("draft-moved")).toHaveTextContent("This bill reached you after the 19th, so it's drafted on the next 1st at least 10 days later.");
    expect(within(months[1]).queryByTestId("draft-moved")).toBeNull();
    // The money comes first in each month: the total and what you pay, above the lines.
    expect(months[0].querySelector('[data-testid="you-pay"]')!.compareDocumentPosition(nov.getAllByTestId("bill-line")[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(months[1]).getByRole("heading", { name: "December" })).toBeInTheDocument();
    expect(flat(within(months[1]).getByTestId("draft-date").textContent)).toBe("Tuesday, December 1");
    expect(screen.getByText("Sample bills, worked out from your lesson dates. Nothing is ever charged in the sample.")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\bfees?\b|surcharge/i);
  });
});

describe("messages and notes", () => {
  it("sends a ready-made note picked from a lesson date; it waits for a person, then shows read", async () => {
    const store = freshStore();
    const { familyId } = await signUp(store);
    setPathname("/more/messages/new");
    window.history.replaceState({}, "", "/more/messages/new?kind=miss");
    render(<SendNoteScreen />);
    // One swimmer: straight to the dates. Never a closed day.
    expect(await screen.findByRole("heading", { name: "Which lesson will Mia miss?" })).toBeInTheDocument();
    expect(screen.queryByTestId("miss-2026-11-29")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    await act(async () => fireEvent.click(screen.getByTestId("miss-2026-11-08")));
    expect(flat((await screen.findByTestId("note-preview")).textContent)).toBe("We'll miss Mia's lesson on Sunday, November 8.");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send this note" })));
    expect(pushes[pushes.length - 1]).toBe("/more/messages?sent=1");
    cleanup();

    setPathname("/more/messages");
    window.history.replaceState({}, "", "/more/messages?sent=1");
    render(<MessagesScreen />);
    expect(await screen.findByText("Sent. A person at the school reads every note.")).toBeInTheDocument();
    const note = screen.getByTestId("family-note");
    expect(flat(note.textContent)).toContain("We'll miss Mia's lesson on Sunday, November 8.");
    expect(within(note).getByTestId("note-status")).toHaveTextContent("Waiting for a person to read it.");
    const id = (await store.snapshot()).familyNotes[0].id;
    await act(() => store.transaction((tx) => markNoteRead(tx, { noteId: id, now: "2026-10-31T14:00:00.000Z", by: "the school" })));
    expect(await within(screen.getByTestId("family-note")).findByText(/Read by the school on October 31, 2026/)).toBeInTheDocument();
    // Lesson dates mark the day.
    cleanup();
    render(<LessonDatesScreen />);
    // A person read the note and offered no fill-in: the family's page says so.
    expect(flat((await screen.findByTestId("missing-day")).textContent)).toBe("Sunday, November 8Not comingWe read your note. There's no fill-in for this one.");
    expect(familyId).toBeTruthy();
  });

  it("a waitlist offer: words, both prices, and the family's yes books it", async () => {
    const store = freshStore();
    const { familyId } = await signUp(store, adaDraft());
    await act(async () => {
      await store.transaction((tx) => pretendFamilyLeft(tx, { today: TODAY }));
      const [item] = waitlistItems(await store.snapshot(), TODAY);
      await store.transaction((tx) => sendWaitlistOffer(tx, { entryId: item.entry.id, classId: "buc-sun-0900-cove", inPlaceOfEnrollmentId: item.ownClasses[0].enrollment.id, today: TODAY, now: NOW, newId: testId }));
    });
    render(<HomeScreen />);
    const answer = await screen.findByTestId("home-needs-answer");
    expect(flat(answer.textContent)).toContain("A spot opened for Ada. Please answer by Friday, November 6.");
    // It comes first on Home, with the one filled button.
    expect(screen.getAllByRole("heading", { level: 2 })[0]).toHaveTextContent("The school needs your answer");
    expect(within(answer).getByRole("button", { name: "See Ada's spot" })).toBeInTheDocument();
    cleanup();
    render(<MessagesScreen />);
    const offer = await screen.findByTestId("school-offer");
    // Not from a note of the family's: a plain "spot" title.
    expect(within(offer).getByRole("heading", { level: 3 })).toHaveTextContent("A spot for Ada");
    expect(flat(within(offer).getByTestId("offer-words").textContent)).toBe(
      "A spot opened for Ada in the Sunday 9:00 am class at Buckhead. If you say yes, Ada moves there, and the Sunday 10:00 am class ends the day you say yes. If you say no, nothing changes. Please answer by Friday, November 6.",
    );
    expect(flat(offer.textContent)).toContain("Bank draft$36.00 a lesson");
    expect(flat(offer.textContent)).toContain("If you say yes today, the first lesson there is Sunday, November 8.");
    await act(async () => fireEvent.click(within(offer).getByRole("button", { name: "Yes, move Ada" })));
    expect(flat((await screen.findByTestId("offer-status")).textContent)).toBe(
      "You said yes on Friday, October 30. Ada's first lesson in the Sunday 9:00 am class at Buckhead, with Coach Wren, is Sunday, November 8. Ada's Sunday 10:00 am class at Buckhead has ended.",
    );
    const data = await store.snapshot();
    expect(data.enrollments.filter((e) => e.familyId === familyId && !e.endedOn).map((e) => e.timeId)).toEqual(["buc-sun-0900-cove"]);
    // The 10:00 class is kept with its end date, so its bill and notes still find it.
    expect(data.enrollments.find((e) => e.familyId === familyId && e.timeId === "buc-sun-1000-cove")!.endedOn).toBe(TODAY);
  });

  it("a lesson the school cancels: the notice, the date offered, and the family's answer", async () => {
    const store = freshStore();
    const { familyId } = await signUp(store);
    await act(async () => {
      await store.transaction((tx) => pretendSchoolCancelled(tx, { familyId, today: TODAY, now: NOW, newId: testId }));
    });
    render(<MessagesScreen />);
    const card = await screen.findByTestId("school-cancelled");
    expect(within(card).getByRole("heading", { name: "We cancelled Mia's lesson" })).toBeInTheDocument();
    expect(flat(card.textContent)).toContain("Sunday, November 1 at 10:00 am, Madison. Coach Dev is away that day (sample).");
    expect(within(card).getByTestId("offer-status")).toHaveTextContent("A person at the school is choosing a date with Coach Dev.");
    const owedId = (await store.snapshot()).owedLessons[0].id;
    await act(async () => {
      await store.transaction((tx) => sendOwedOffer(tx, { owedId, timeId: "mad-eval-sun-1100", date: "2026-11-08", today: TODAY, now: NOW }));
    });
    await act(async () => fireEvent.click(await within(screen.getByTestId("school-cancelled")).findByRole("button", { name: "Yes, that works" })));
    expect(flat((await screen.findByTestId("offer-status")).textContent)).toBe("You said yes on Friday, October 30. Mia's lesson is on Sunday, November 8 at 11:00 am at Madison, with Coach Dev.");
    cleanup();
    render(<LessonDatesScreen />);
    const cancelledDay = await screen.findByTestId("cancelled-day");
    expect(flat(cancelledDay.textContent)).toContain("Sunday, November 1CancelledWe cancelled this lesson. Coach Dev is away that day (sample).");
    // The new date sits right under the cancelled one, in Mia's own card, said once.
    expect(flat(within(cancelledDay).getByTestId("owed-day").textContent)).toBe("New dateSunday, November 8 at 11:00 am with Coach Dev");
    expect(flat(cancelledDay.textContent)).not.toContain("Its new date is");
    // Mia's weekly lesson that day shows its own time, so the two don't mix up.
    expect(screen.getAllByTestId("lesson-day").map((li) => flat(li.textContent))).toContain("Sunday, November 8 at 10:00 amMia also has a new date at 11:00 am that day.");
    cleanup();
    render(<BillsScreen />);
    expect(flat((await screen.findAllByTestId("cancelled-billed"))[0].textContent)).toBe("November 1: we cancelled this lesson. Its new date is Sunday, November 8.");
  });
});

describe("leaving a waitlist", () => {
  it("Home asks first, then takes the swimmer off it", async () => {
    const store = freshStore();
    const { familyId } = await signUp(store, adaDraft());
    render(<HomeScreen />);
    const line = await screen.findByTestId("home-waitlist");
    expect(flat(line.textContent)).toContain("On the waitlist for Sundays at 9:00 am at Buckhead.");
    await act(async () => fireEvent.click(within(line).getByRole("button", { name: "Leave this waitlist" })));
    expect(flat(screen.getByTestId("home-waitlist").textContent)).toContain("Take Ada off the waitlist for Sundays at 9:00 am at Buckhead?");
    // The answer that changes nothing comes first, filled, and has the focus.
    const confirm = within(screen.getByTestId("leave-confirm")).getAllByRole("button");
    expect(confirm.map((b) => b.textContent)).toEqual(["Stay on it", "Leave the waitlist"]);
    expect(document.activeElement).toBe(confirm[0]);
    await act(async () => fireEvent.click(within(screen.getByTestId("home-waitlist")).getByRole("button", { name: "Stay on it" })));
    expect((await store.snapshot()).waitlistEntries.filter((w) => w.familyId === familyId)).toHaveLength(1);
    await act(async () => fireEvent.click(within(screen.getByTestId("home-waitlist")).getByRole("button", { name: "Leave this waitlist" })));
    await act(async () => fireEvent.click(within(screen.getByTestId("home-waitlist")).getByRole("button", { name: "Leave the waitlist" })));
    expect((await store.snapshot()).waitlistEntries.filter((w) => w.familyId === familyId)).toEqual([]);
    expect(screen.queryByTestId("home-waitlist")).toBeNull();
  });
});

describe("leaving a waitlist while an offer waits, and after", () => {
  it("Home points to Messages instead; once the family leaves, Messages stops saying the child stays on it", async () => {
    const store = freshStore();
    const { familyId } = await signUp(store, adaDraft());
    let offerId = "";
    await act(async () => {
      await store.transaction((tx) => pretendFamilyLeft(tx, { today: TODAY }));
      const [item] = waitlistItems(await store.snapshot(), TODAY);
      offerId = (await store.transaction((tx) => sendWaitlistOffer(tx, { entryId: item.entry.id, classId: "buc-sun-0900-cove", inPlaceOfEnrollmentId: null, today: TODAY, now: NOW, newId: testId }))).id;
    });
    render(<HomeScreen />);
    const line = await screen.findByTestId("home-waitlist");
    expect(within(line).queryByRole("button", { name: "Leave this waitlist" })).toBeNull();
    await act(async () => fireEvent.click(within(line).getByRole("button", { name: "The school offered a spot. Answer it in Messages." })));
    expect(pushes[pushes.length - 1]).toBe("/more/messages");
    cleanup();
    await act(async () => {
      await store.transaction((tx) => answerWaitlistOffer(tx, { offerId, familyId, answer: "no", today: TODAY, now: NOW, newId: testId }));
    });
    render(<MessagesScreen />);
    expect(flat((await screen.findByTestId("offer-status")).textContent)).toBe("You said no, thanks on Friday, October 30. Ada stays on the waitlist.");
    await act(async () => {
      const entry = (await store.snapshot()).waitlistEntries.find((w) => w.familyId === familyId)!;
      await store.transaction((tx) => leaveWaitlist(tx, { entryId: entry.id, familyId, today: TODAY }));
    });
    expect(flat((await screen.findByTestId("offer-status")).textContent)).toBe("You said no, thanks on Friday, October 30.");
  });
});

describe("a lesson and a new date on the same day", () => {
  it("Home and Your first lesson list both, each with its own time", async () => {
    const store = freshStore();
    const { familyId } = await signUp(store);
    await act(async () => {
      await store.transaction((tx) => pretendSchoolCancelled(tx, { familyId, today: TODAY, now: NOW, newId: testId }));
      const owedId = (await store.snapshot()).owedLessons[0].id;
      await store.transaction((tx) => sendOwedOffer(tx, { owedId, timeId: "mad-eval-sun-1100", date: "2026-11-08", today: TODAY, now: NOW }));
      await store.transaction((tx) => answerOwedOffer(tx, { owedId, familyId, answer: "yes", today: TODAY, now: NOW }));
    });
    render(<HomeScreen />);
    const rows = within(await screen.findByTestId("home-lead-children")).getAllByRole("listitem").map((li) => flat(li.textContent));
    expect(rows).toEqual(["Mia, 10:00 am with Coach Dev", "Mia, 11:00 am with Coach Dev, in place of the lesson we cancelled on Sunday, November 1"]);
    cleanup();
    render(<FirstLessonScreen />);
    const tickets = await screen.findAllByTestId("lesson-ticket");
    expect(tickets.map((t) => flat(within(t).getByTestId("lesson-time").textContent))).toEqual(["10:00 am", "11:00 am"]);
    expect(within(tickets[1]).getByTestId("lesson-in-place")).toHaveTextContent("In place of the lesson we cancelled on Sunday, November 1.");
  });
});

describe("a replacement date as the next lesson", () => {
  it("Home and Your first lesson show it, with the lesson it replaces", async () => {
    const store = freshStore();
    const { familyId } = await signUp(
      store,
      completeDraft({ id: "draft-remy", poolId: "pool-buckhead", kids: [{ firstName: "Remy", birth: "2021-06-01", stage: "shallows", booking: { kind: "class", timeId: "buc-wed-1600-shallows" } }] }),
    );
    await act(async () => {
      const [owed] = await store.transaction((tx) => cancelClassDate(tx, { classId: "buc-wed-1600-shallows", date: "2026-11-11", reason: "Coach Wren is away that day (sample)", now: NOW, newId: testId }));
      await store.transaction((tx) => sendOwedOffer(tx, { owedId: owed.id, timeId: "buc-eval-sun-1130", date: "2026-11-15", today: TODAY, now: NOW }));
      await store.transaction((tx) => answerOwedOffer(tx, { owedId: owed.id, familyId, answer: "yes", today: TODAY, now: NOW }));
    });
    render(<HomeScreen />);
    const lead = await screen.findByTestId("home-lead");
    expect(flat(lead.textContent)).toContain("Sunday, November 15, 11:30 am");
    expect(flat(lead.textContent)).toContain("Remy at Buckhead with Coach Wren");
    expect(flat(within(lead).getByTestId("home-in-place").textContent)).toBe("In place of the lesson we cancelled on Wednesday, November 11.");
    cleanup();
    render(<FirstLessonScreen />);
    const ticket = await screen.findByTestId("lesson-ticket");
    expect(flat(ticket.textContent)).toContain("Sunday, November 15");
    expect(flat(ticket.textContent)).toContain("11:30 am");
    expect(flat(ticket.textContent)).toContain("Buckhead, Coach Wren");
    expect(flat(within(ticket).getByTestId("lesson-in-place").textContent)).toBe("In place of the lesson we cancelled on Wednesday, November 11.");
  });
});

describe("the approvals inbox", () => {
  it("a person talks with a family, offers a spot and a date, and reads a note; the app only drafts", async () => {
    const store = freshStore();
    const { familyId: adaFamily } = await signUp(store, adaDraft());
    const { familyId: miaFamily } = await signUp(store, completeDraft({ id: "draft-mia" }));
    await act(async () => {
      await store.transaction((tx) => pretendSchoolCancelled(tx, { familyId: miaFamily, today: TODAY, now: NOW, newId: testId }));
      const mia = (await store.snapshot()).children.find((c) => c.familyId === miaFamily)!;
      await store.transaction((tx) => sendNote(tx, { familyId: miaFamily, childRecordId: mia.id, kind: "move", today: TODAY, now: NOW, newId: testId }));
      await store.transaction((tx) => setCurrentFamily(tx, null, "owner"));
    });
    render(<InboxScreen />);
    expect(await screen.findByRole("heading", { level: 1, name: "Inbox" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Owner tabs" })).toBeInTheDocument();

    // Talk with a family first: which question had the yes, never details.
    const talk = screen.getByTestId("inbox-talk");
    expect(flat(talk.textContent)).toContain("A yes on the custody question. Their first lesson, Sunday, November 8 at Buckhead, waits until someone has talked with the family.");
    await act(async () => fireEvent.click(within(talk).getByRole("button", { name: "We've talked with the family" })));
    expect(screen.queryByTestId("inbox-talk")).toBeNull();
    expect((await store.snapshot()).children.find((c) => c.familyId === adaFamily)!.flaggedForPerson).toBe(false);

    // Owed lessons: a person picks the date, sees the drafted words, then sends.
    const owed = screen.getByTestId("inbox-owed");
    expect(within(owed).queryByTestId("draft")).toBeNull();
    await act(async () => fireEvent.click(within(owed).getByTestId("owed-slot-2026-11-08-1100")));
    expect(flat(within(owed).getByTestId("draft-words").textContent)).toBe(
      "We cancelled Mia's lesson on Sunday, November 1. We can offer Sunday, November 8 at 11:00 am with Coach Dev at Madison instead. Does that work? Please answer by Friday, November 6.",
    );
    expect(within(owed).getByTestId("draft")).toHaveTextContent("Goes to Jordan Sample's Messages in the app.");
    await act(async () => fireEvent.click(within(owed).getByRole("button", { name: "Send the offer (sample)" })));
    expect(flat((await within(screen.getByTestId("inbox-owed")).findByTestId("inbox-waiting")).textContent)).toBe(
      "Offered Sunday, November 8. Waiting for the family's answer by Friday, November 6.",
    );

    // The waitlist: no spot yet; then a family leaves; the person chooses a switch, sees the words, sends.
    expect(within(screen.getByTestId("inbox-waitlist")).getByText("No spot that fits is open yet.")).toBeInTheDocument();
    await act(async () => {
      await store.transaction((tx) => pretendFamilyLeft(tx, { today: TODAY }));
    });
    const wait = screen.getByTestId("inbox-waitlist");
    expect(within(wait).queryByTestId("draft")).toBeNull();
    await act(async () => fireEvent.click(within(wait).getByRole("button", { name: /^In place of the Sunday 10:00\sam class/ })));
    expect(flat(within(wait).getByTestId("draft-words").textContent)).toContain("If you say yes, Ada moves there, and the Sunday 10:00 am class ends the day you say yes.");
    await act(async () => fireEvent.click(within(wait).getByRole("button", { name: "Send the offer (sample)" })));
    expect(await within(screen.getByTestId("inbox-waitlist")).findByTestId("inbox-waiting")).toBeInTheDocument();
    expect((await store.snapshot()).waitlistOffers).toHaveLength(1);

    // Notes from families: a person marks each one read.
    const note = screen.getByTestId("inbox-note");
    expect(flat(within(note).getByTestId("inbox-note-words").textContent)).toBe("We'd like to talk about a different lesson time for Mia.");
    // A different-time note with nothing open at Mia's pool: the person chooses to read it and add no waitlist.
    expect(flat(note.textContent)).toContain("No other time that fits Mia is open at Madison now.");
    await act(async () => fireEvent.click(within(note).getByRole("button", { name: "Mark as read, no waitlist" })));
    expect(screen.queryByTestId("inbox-note")).toBeNull();
    expect(flat(screen.getByTestId("inbox-done").textContent)).toContain("Read: \"We'd like to talk about a different lesson time for Mia.\"");
  });
});

describe("fill-ins", () => {
  it("a person picks one date from the family's note; the family says yes; Lesson dates show it under the missed day", async () => {
    const store = freshStore();
    const { familyId } = await signUp(store);
    await act(async () => {
      const mia = (await store.snapshot()).children.find((c) => c.familyId === familyId)!;
      const enrollmentId = (await store.snapshot()).enrollments.find((e) => e.childRecordId === mia.id)!.id;
      await store.transaction((tx) => sendNote(tx, { familyId, childRecordId: mia.id, kind: "miss", enrollmentId, lessonDate: "2026-11-08", today: TODAY, now: NOW, newId: testId }));
    });
    render(<InboxScreen />);
    const note = await screen.findByTestId("inbox-note");
    expect(flat(note.textContent)).toContain("A fill-in: one date with Coach Dev the week after. Pick one, or none. Once you send it, there's no second date.");
    expect(within(note).queryByTestId("draft")).toBeNull();
    await act(async () => fireEvent.click(within(note).getByTestId("fill-in-slot-2026-11-15-1100")));
    expect(flat(within(note).getByTestId("draft-words").textContent)).toBe(
      "You told us Mia will miss Sunday, November 8. We can offer a fill-in on Sunday, November 15 at 11:00 am with Coach Dev at Madison. It's the one fill-in for this lesson, and it costs nothing extra. Does that work? Please answer by Saturday, November 14. If we don't hear by then, we'll close it.",
    );
    await act(async () => fireEvent.click(within(note).getByRole("button", { name: "Send the fill-in (sample)" })));
    expect(screen.queryByTestId("inbox-note")).toBeNull();
    cleanup();

    render(<HomeScreen />);
    const answer = await screen.findByTestId("home-needs-answer");
    expect(flat(answer.textContent)).toContain("A fill-in for Mia's missed lesson. Please answer by Saturday, November 14.");
    expect(within(answer).getByRole("button", { name: "See Mia's fill-in" })).toBeInTheDocument();
    cleanup();

    render(<MessagesScreen />);
    const card = await screen.findByTestId("school-fill-in");
    expect(within(card).getByRole("heading", { name: "A fill-in for Mia" })).toBeInTheDocument();
    await act(async () => fireEvent.click(within(card).getByRole("button", { name: "Yes, that works" })));
    expect(flat((await within(screen.getByTestId("school-fill-in")).findByTestId("offer-status")).textContent)).toBe("You said yes on Friday, October 30. Mia's fill-in is on Sunday, November 15 at 11:00 am at Madison, with Coach Dev, for the lesson on Sunday, November 8.");
    // The family's note was read by the person who sent the fill-in.
    expect(within(screen.getByTestId("family-note")).getByTestId("note-status")).toHaveTextContent("Read by the school on");
    cleanup();

    render(<LessonDatesScreen />);
    const missed = await screen.findByTestId("missing-day");
    expect(flat(missed.textContent)).toContain("You sent a note that Mia will miss it.");
    expect(flat(within(missed).getByTestId("fill-in-day").textContent)).toBe("Fill-inSunday, November 15 at 11:00 am with Coach Dev");
  });
});

describe("a different time, from the inbox", () => {
  /** Mia's family (Sundays at 10:00 at Madison) asks for a different time, once a sample family leaves the full Wednesday 4:30 class there. */
  async function miaAsks(store: LocalStore, draft: SignUpDraft = completeDraft({})) {
    const { familyId } = await signUp(store, draft);
    await act(async () => {
      await store.transaction((tx) => tx.update("classes", "mad-wed-1630-shallows", { openSpots: 1 }));
      const mia = (await store.snapshot()).children.find((c) => c.familyId === familyId && c.firstName === "Mia")!;
      await store.transaction((tx) => sendNote(tx, { familyId, childRecordId: mia.id, kind: "move", today: TODAY, now: NOW, newId: testId }));
    });
    return familyId;
  }

  it("a person picks an open time, sees the words, and sends it in place of the child's class", async () => {
    const store = freshStore();
    await miaAsks(store);
    render(<InboxScreen />);
    const note = await screen.findByTestId("inbox-note");
    expect(flat(note.textContent)).toContain("A different time: pick one to offer, or none.");
    expect(within(note).queryByTestId("draft")).toBeNull();
    await act(async () => fireEvent.click(within(note).getByTestId("different-time-mad-wed-1630-shallows")));
    expect(flat(within(note).getByTestId("draft-words").textContent)).toContain("If you say yes, Mia moves there, and the Sunday 10:00 am class ends the day you say yes.");
    await act(async () => fireEvent.click(within(note).getByRole("button", { name: "Send the offer (sample)" })));
    expect(screen.queryByTestId("inbox-note")).toBeNull();
    const wait = await screen.findByTestId("inbox-waitlist");
    expect(flat(wait.textContent)).toContain("after the family asked for a different time.");
    expect(within(wait).getByTestId("inbox-waiting")).toHaveTextContent("Offer sent.");
  });

  async function miaOffered(store: LocalStore) {
    const familyId = await miaAsks(store);
    render(<InboxScreen />);
    const note = await screen.findByTestId("inbox-note");
    // The person sees which class it replaces, each time's prices, and what reading the note without an offer does.
    expect(flat(within(note).getByTestId("in-place-of").textContent)).toBe("This takes the place of Mia's class: Sundays at 10:00 am, Madison, Coach Dev. It doesn't add a class.");
    const time = within(note).getByTestId("different-time-mad-wed-1630-shallows");
    expect(flat(time.textContent)).toContain("Bank draft$");
    expect(flat(note.textContent)).toContain("Mia stays in the Sunday 10:00 am class. The family sees you read their note.");
    await act(async () => fireEvent.click(time));
    await act(async () => fireEvent.click(within(note).getByRole("button", { name: "Send the offer (sample)" })));
    cleanup();
    return familyId;
  }

  it("the family sees now and new before answering; a yes says the old class ended, and Home says so until the first lesson", async () => {
    const store = freshStore();
    await miaOffered(store);
    render(<HomeScreen />);
    expect(flat((await screen.findByTestId("home-needs-answer")).textContent)).toContain("A different time for Mia. Please answer by Friday, November 6.");
    expect(screen.getByRole("button", { name: "See Mia's new time" })).toBeInTheDocument();
    cleanup();
    render(<MessagesScreen />);
    const offer = await screen.findByTestId("school-offer");
    expect(within(offer).getByRole("heading", { level: 3 })).toHaveTextContent("A different time for Mia");
    const both = flat(within(offer).getByTestId("now-and-new").textContent);
    // Same price: Now doesn't repeat it; New shows it once, with "Same as now."
    expect(both).toContain("NowSundays at 10:00 am, Madison, Coach DevEnds the day you say yes.");
    expect(both).toContain("NewWednesdays at 4:30 pm, Madison, Coach TamsinBank draft$34.00 a lessonCard$35.00 a lessonSame as now.");
    expect(within(offer).getByRole("button", { name: "No, keep Mia's class" })).toBeInTheDocument();
    await act(async () => fireEvent.click(within(offer).getByRole("button", { name: "Yes, move Mia" })));
    expect(flat((await screen.findByTestId("offer-status")).textContent)).toBe(
      "You said yes on Friday, October 30. Mia's first lesson in the Wednesday 4:30 pm class at Madison, with Coach Tamsin, is Wednesday, November 4. Mia's Sunday 10:00 am class at Madison has ended.",
    );
    // Once answered, the card shows what happened, not the question.
    expect(screen.queryByTestId("offer-words")).toBeNull();
    cleanup();
    render(<HomeScreen />);
    expect(await screen.findAllByTestId("home-class")).toHaveLength(1);
    expect(flat(screen.getByTestId("home-switched").textContent)).toBe("New class from Wednesday, November 4. The Sunday 10:00 am class at Madison has ended.");
    cleanup();
    // After that first lesson, Home stops saying so.
    vi.setSystemTime(new Date("2026-11-05T17:00:00Z"));
    render(<HomeScreen />);
    await screen.findAllByTestId("home-class");
    expect(screen.queryByTestId("home-switched")).toBeNull();
  });

  it("a no keeps the class and the waitlist the family asked for", async () => {
    const store = freshStore();
    await miaOffered(store);
    render(<MessagesScreen />);
    const offer = await screen.findByTestId("school-offer");
    await act(async () => fireEvent.click(within(offer).getByRole("button", { name: "No, keep Mia's class" })));
    expect(flat((await screen.findByTestId("offer-status")).textContent)).toBe("You said no, thanks on Friday, October 30. Mia keeps the class now. Mia stays on the waitlist.");
    cleanup();
    render(<HomeScreen />);
    await screen.findAllByTestId("home-class");
    expect(screen.queryByTestId("home-switched")).toBeNull();
  });

  it("with two classes, the person picks which one it replaces", async () => {
    const store = freshStore();
    const familyId = await miaAsks(store);
    await act(async () => {
      const mia = (await store.snapshot()).children.find((c) => c.familyId === familyId)!;
      await store.transaction((tx) => bookTime(tx, { familyId, childRecordId: mia.id, booking: { kind: "class", timeId: "buc-wed-1600-shallows" }, poolId: "pool-buckhead", today: TODAY, now: NOW, newId: testId, alone: true }));
    });
    render(<InboxScreen />);
    const note = await screen.findByTestId("inbox-note");
    expect(within(note).queryByTestId("in-place-of")).toBeNull();
    // The open Wednesday time is half an hour after Mia's Wednesday class at the other pool: the person sees that before choosing.
    const time = within(note).getByTestId("different-time-mad-wed-1630-shallows");
    expect(flat(time.textContent)).toContain("Starts 30 minutes after Mia's Wednesday 4:00 pm class at Buckhead.");
    await act(async () => fireEvent.click(time));
    expect(within(note).queryByTestId("draft")).toBeNull();
    await act(async () => fireEvent.click(within(note).getByRole("button", { name: /^the Wednesday 4:00\spm class, Buckhead$/ })));
    expect(flat(within(note).getByTestId("draft-words").textContent)).toContain("Mia moves there, and the Wednesday 4:00 pm class at Buckhead ends the day you say yes.");
    await act(async () => fireEvent.click(within(note).getByRole("button", { name: "Send the offer (sample)" })));
    cleanup();
    // The family's card says which class a yes leaves as it is.
    render(<MessagesScreen />);
    expect(flat((await screen.findByTestId("others-stay")).textContent)).toBe("Mia's Sunday 10:00 am class at Madison stays as it is.");
  });

  it("the family's note says what the school did, the owner's Done says it once, and Home marks a new class", async () => {
    const store = freshStore();
    const familyId = await miaAsks(store);
    // Nothing open after all: the Wednesday spot fills again before a person reads the note.
    await act(async () => void (await store.transaction((tx) => tx.update("classes", "mad-wed-1630-shallows", { openSpots: 0 }))));
    render(<InboxScreen />);
    const note = await screen.findByTestId("inbox-note");
    await act(async () => fireEvent.click(within(note).getByRole("button", { name: "Put Mia on the Madison waitlist for any time that fits" })));
    const done = flat((await screen.findByTestId("inbox-done")).textContent);
    expect(done).toContain("Put Mia on the Madison waitlist for any time that fits, after Jordan Sample's note about a different time.");
    expect(done).not.toContain("Read: \"We'd like to talk about a different lesson time for Mia.\"");
    cleanup();
    render(<MessagesScreen />);
    expect(flat((await screen.findByTestId("note-status")).textContent)).toMatch(/^ReadRead by the school on .+\. Mia is on the Madison waitlist for any time that fits\.$/);
    cleanup();
    // A spot opens; a person offers it from that waitlist; the family says yes.
    await act(async () => {
      await store.transaction((tx) => pretendFamilyLeft(tx, { today: TODAY }));
      const [item] = waitlistItems(await store.snapshot(), TODAY);
      const offer = await store.transaction((tx) => sendWaitlistOffer(tx, { entryId: item.entry.id, classId: "mad-wed-1630-shallows", inPlaceOfEnrollmentId: item.ownClasses[0].enrollment.id, today: TODAY, now: NOW, newId: testId }));
      await store.transaction((tx) => answerWaitlistOffer(tx, { offerId: offer.id, familyId, answer: "yes", today: TODAY, now: NOW, newId: testId }));
    });
    render(<MessagesScreen />);
    expect(flat((await screen.findByTestId("note-status")).textContent)).toContain("The school offered a different time, above.");
    cleanup();
    render(<InboxScreen />);
    expect(flat((await screen.findByTestId("inbox-done")).textContent)).toContain("Offered Mia the Wednesday 4:30 pm class at Madison, in place of the Sunday 10:00 am class. They said yes.");
    cleanup();
    render(<HomeScreen />);
    const block = (await screen.findAllByTestId("home-class"))[0];
    expect(within(block).getByText("New")).toBeInTheDocument();
  });

  it("an offer already waiting, or a family with no way to pay yet, is said before any time is offered", async () => {
    const store = freshStore();
    const familyId = await miaAsks(store);
    await act(async () => {
      // Mia's first note gets an offer; the family then sends another.
      const data = await store.snapshot();
      const note = data.familyNotes.find((n) => n.familyId === familyId)!;
      const own = data.enrollments.find((e) => e.childRecordId === note.childRecordId)!;
      await store.transaction((tx) => offerDifferentTime(tx, { noteId: note.id, classId: "mad-wed-1630-shallows", inPlaceOfEnrollmentId: own.id, today: TODAY, now: NOW, newId: testId }));
      await store.transaction((tx) => sendNote(tx, { familyId, childRecordId: note.childRecordId, kind: "move", today: TODAY, now: NOW, newId: testId }));
      // The family moving over has its classes but no bank linked yet; Juniper's family asks too.
      await store.transaction((tx) => sendNote(tx, { familyId: "family-whitcombe", childRecordId: "child-juniper", kind: "move", today: TODAY, now: NOW, newId: testId }));
    });
    render(<InboxScreen />);
    const [miaNote, juniperNote] = await screen.findAllByTestId("inbox-note");
    expect(flat(miaNote.textContent)).toContain("An offer for Mia is already waiting for the family's answer, by Friday, November 6.");
    expect(within(miaNote).queryByTestId("different-time-mad-wed-1630-shallows")).toBeNull();
    expect(flat(juniperNote.textContent)).toContain("This family hasn't set up how they'll pay for lessons. Talk with them before offering a time.");
    expect(within(juniperNote).queryByTestId("different-time-mad-sun-1000-shallows")).toBeNull();
    expect(within(juniperNote).getByRole("button", { name: "Put Juniper on the Madison waitlist for any time that fits" })).toBeInTheDocument();
  });
});

describe("missed days and fill-ins on every screen", () => {
  async function miaMisses(store: LocalStore, familyId: string, date: string) {
    const data = await store.snapshot();
    const mia = data.children.find((c) => c.familyId === familyId && c.firstName === "Mia")!;
    const enrollmentId = data.enrollments.find((e) => e.childRecordId === mia.id && e.timeId === "mad-sun-1000-shallows")!.id;
    return store.transaction((tx) => sendNote(tx, { familyId, childRecordId: mia.id, kind: "miss", enrollmentId, lessonDate: date, today: TODAY, now: NOW, newId: testId }));
  }

  it("a missed first day isn't the next lesson on Home or Your first lesson", async () => {
    const store = freshStore();
    const { familyId } = await signUp(store);
    await act(async () => void (await miaMisses(store, familyId, "2026-11-01")));
    render(<HomeScreen />);
    expect(flat((await screen.findByTestId("home-lead")).textContent)).toContain("Sunday, November 8, 10:00 am");
    cleanup();
    render(<FirstLessonScreen />);
    expect(flat((await screen.findByTestId("lesson-ticket")).textContent)).toContain("Sunday, November 8");
  });

  it("a fill-in the same day as a weekly lesson shows on Home as its own row", async () => {
    const store = freshStore();
    const { familyId } = await signUp(store);
    await act(async () => {
      const note = await miaMisses(store, familyId, "2026-11-01");
      const f = await store.transaction((tx) => sendFillIn(tx, { noteId: note.id, timeId: "mad-eval-sun-1100", date: "2026-11-08", today: TODAY, now: NOW, newId: testId }));
      await store.transaction((tx) => answerFillIn(tx, { fillInId: f.id, familyId, answer: "yes", today: TODAY, now: NOW }));
    });
    render(<HomeScreen />);
    const rows = within(await screen.findByTestId("home-lead-children")).getAllByRole("listitem").map((li) => flat(li.textContent));
    expect(rows).toEqual(["Mia, 10:00 am with Coach Dev", "Mia, 11:00 am with Coach Dev, a fill-in for the lesson on Sunday, November 1"]);
  });

  it("a day that mixes pools names the pool on each row", async () => {
    const store = freshStore();
    const { familyId } = await signUp(store);
    await act(async () => {
      await miaMisses(store, familyId, "2026-11-01");
      // A brother at Buckhead, whose first Sunday is November 8 too.
      const leo = await store.transaction((tx) =>
        tx.add("children", { id: "child-leo-test", familyId, firstName: "Leo", birthDate: "2023-05-01", childId: null, stageId: "pier", flaggedForPerson: false, createdAt: NOW }),
      );
      await store.transaction((tx) => bookTime(tx, { familyId, childRecordId: leo.id, booking: { kind: "class", timeId: "buc-sun-0930-pier" }, poolId: "pool-buckhead", today: TODAY, now: NOW, newId: testId, alone: true }));
    });
    render(<HomeScreen />);
    const lead = await screen.findByTestId("home-lead");
    const rows = within(lead).getAllByRole("listitem").map((li) => flat(li.textContent));
    expect(rows).toEqual(["Leo, 9:30 am with Coach Wren at Buckhead", "Mia, 10:00 am with Coach Dev at Madison"]);
    expect(flat(lead.textContent)).not.toMatch(/At (Madison|Buckhead)/);
  });

  it("the inbox can read a miss with no fill-in; Messages can say no; Lesson dates say where each stands", async () => {
    const store = freshStore();
    const { familyId } = await signUp(store);
    await act(async () => {
      await miaMisses(store, familyId, "2026-11-01");
      const second = await miaMisses(store, familyId, "2026-11-08");
      await store.transaction((tx) => sendFillIn(tx, { noteId: second.id, timeId: "mad-eval-sun-1100", date: "2026-11-15", today: TODAY, now: NOW, newId: testId }));
    });
    render(<InboxScreen />);
    // The November 1 note: the person reads it and offers no fill-in.
    const note = await screen.findByTestId("inbox-note");
    await act(async () => fireEvent.click(within(note).getByRole("button", { name: "Mark as read, no fill-in" })));
    expect(screen.queryByTestId("inbox-note")).toBeNull();
    cleanup();
    render(<LessonDatesScreen />);
    const before = (await screen.findAllByTestId("missing-day")).map((li) => flat(li.textContent));
    expect(before).toEqual([
      "Sunday, November 1Not comingWe read your note. There's no fill-in for this one.",
      "Sunday, November 8Not comingYou sent a note that Mia will miss it. Messages has a fill-in for you to answer.",
    ]);
    cleanup();
    render(<MessagesScreen />);
    const card = await screen.findByTestId("school-fill-in");
    // Each note says what the school did: newest first, the one with a fill-in, then the one read without.
    const statuses = (await screen.findAllByTestId("note-status")).map((p) => flat(p.textContent));
    expect(statuses[0]).toMatch(/\. The school offered a fill-in, above\.$/);
    expect(statuses[1]).toMatch(/\. There's no fill-in for this one\.$/);
    await act(async () => fireEvent.click(within(card).getByRole("button", { name: "No, thanks" })));
    expect(flat((await within(screen.getByTestId("school-fill-in")).findByTestId("offer-status")).textContent)).toBe(
      "You said no, thanks on Friday, October 30, to a fill-in on Sunday, November 15. The lesson on Sunday, November 8 has no fill-in.",
    );
    cleanup();
    render(<LessonDatesScreen />);
    expect(flat((await screen.findAllByTestId("missing-day"))[1].textContent)).toBe("Sunday, November 8Not comingYou sent a note that Mia will miss it. You said no, thanks, to the fill-in.");
  });

  it("a fill-in nobody answered says it closed; a fill-in at the other pool is named on the day's other row", async () => {
    const store = freshStore();
    const { familyId } = await signUp(store);
    await act(async () => {
      const data = await store.snapshot();
      const mia = data.children.find((c) => c.familyId === familyId)!;
      // Mia's second class, Wednesdays at Buckhead; she'll miss November 11, and Coach Wren's Sunday private time is her fill-in.
      await store.transaction((tx) => bookTime(tx, { familyId, childRecordId: mia.id, booking: { kind: "class", timeId: "buc-wed-1600-shallows" }, poolId: "pool-buckhead", today: TODAY, now: NOW, newId: testId, alone: true }));
      const wed = (await store.snapshot()).enrollments.find((e) => e.childRecordId === mia.id && e.timeId === "buc-wed-1600-shallows")!;
      const note = await store.transaction((tx) => sendNote(tx, { familyId, childRecordId: mia.id, kind: "miss", enrollmentId: wed.id, lessonDate: "2026-11-11", today: TODAY, now: NOW, newId: testId }));
      const f = await store.transaction((tx) => sendFillIn(tx, { noteId: note.id, timeId: "buc-eval-sun-1130", date: "2026-11-15", today: TODAY, now: NOW, newId: testId }));
      await store.transaction((tx) => answerFillIn(tx, { fillInId: f.id, familyId, answer: "yes", today: TODAY, now: NOW }));
      // A second miss, whose fill-in nobody answered by its day (set in the past here).
      const other = await miaMisses(store, familyId, "2026-11-01");
      const g = await store.transaction((tx) => sendFillIn(tx, { noteId: other.id, timeId: "mad-eval-sun-1130", date: "2026-11-08", today: TODAY, now: NOW, newId: testId }));
      await store.transaction((tx) => tx.update("fillIns", g.id, { offer: { ...g.offer, answerBy: "2026-10-29" } }));
    });
    render(<LessonDatesScreen />);
    const madisonRows = (await screen.findAllByTestId("lesson-day")).map((li) => flat(li.textContent));
    expect(madisonRows).toContain("Sunday, November 15 at 10:00 amMia also has a fill-in at 11:30 am at Buckhead that day.");
    expect(flat((await screen.findAllByTestId("missing-day"))[0].textContent)).toBe(
      "Sunday, November 1Not comingYou sent a note that Mia will miss it. The fill-in we offered closed with no answer.",
    );
  });

  it("the leave confirm's safe answer is the filled one", async () => {
    const store = freshStore();
    await signUp(store, adaDraft());
    render(<HomeScreen />);
    const line = await screen.findByTestId("home-waitlist");
    await act(async () => fireEvent.click(within(line).getByRole("button", { name: "Leave this waitlist" })));
    const [stay, leave] = within(screen.getByTestId("leave-confirm")).getAllByRole("button");
    expect(stay.className).toContain("bg-primary");
    expect(leave.className).not.toContain("bg-primary");
  });
});

describe("the approvals inbox, empty", () => {
  it("one plain line, no headed zeros", async () => {
    freshStore();
    render(<InboxScreen />);
    expect(await screen.findByText("Nothing is waiting for a person.")).toBeInTheDocument();
    expect(screen.queryByTestId("inbox-section-talks")).toBeNull();
    expect(screen.queryByTestId("inbox-section-notes")).toBeNull();
    expect(screen.getByRole("heading", { name: "Done" })).toBeInTheDocument();
  });
});

describe("staff page", () => {
  it("marks the later-room rules the owner's rulings built", async () => {
    freshStore();
    render(<StaffScreen />);
    const built = LATER_ROOM_RULES.filter((r) => r.builtIn);
    // Six from rulings 1 to 3, the fill-in rule from ruling 5, and the note about a class with no partner from ruling 6.
    expect(built).toHaveLength(8);
    expect(screen.getAllByText("Built")).toHaveLength(8);
    for (const r of built) expect(screen.getByText(`In ${r.builtIn}.`)).toBeInTheDocument();
  });
});

describe("Home's swimmer cards", () => {
  it("each class is its own block, a hairline between, its when, where and who in semibold", async () => {
    const store = freshStore();
    const { familyId } = await signUp(store);
    await act(async () => {
      const mia = (await store.snapshot()).children.find((c) => c.familyId === familyId)!;
      await store.transaction((tx) => bookTime(tx, { familyId, childRecordId: mia.id, booking: { kind: "class", timeId: "buc-wed-1600-shallows" }, poolId: "pool-buckhead", today: TODAY, now: NOW, newId: testId, alone: true }));
    });
    render(<HomeScreen />);
    const blocks = within((await screen.findAllByTestId("home-child"))[0]).getAllByTestId("home-class");
    expect(blocks.map((b) => flat(b.querySelector("p.font-strong")?.textContent ?? ""))).toEqual(["Sundays at 10:00 am, Madison, Coach Dev", "Wednesdays at 4:00 pm, Buckhead, Coach Wren"]);
    expect(blocks[0].className).not.toContain("border-t");
    expect(blocks[1].className).toContain("border-t");
  });
});

describe("every screen agrees about new dates and fill-ins", () => {
  it("a new date whose day the school then cancels shows as coming nowhere, and each screen says so", async () => {
    const store = freshStore();
    // Coach Dev's Sunday 9:30 class becomes a one-place Shallows class, so Mia's new date can be a class slot.
    await act(async () => void (await store.transaction((tx) => tx.update("classes", "mad-sun-0930-pier", { stageId: "shallows", openSpots: 1, capacity: 1 }))));
    const { familyId } = await signUp(store);
    await act(async () => {
      const [owed] = await store.transaction((tx) => cancelClassDate(tx, { classId: "mad-sun-1000-shallows", date: "2026-11-01", reason: "Coach Dev is away that day (sample)", now: NOW, newId: testId }));
      const state = owedState(await store.snapshot(), owed, TODAY);
      const slot = state.kind === "offer" ? state.slots.find((x) => x.time.id === "mad-sun-0930-pier")! : null;
      await store.transaction((tx) => sendOwedOffer(tx, { owedId: owed.id, timeId: slot!.time.id, date: slot!.date, today: TODAY, now: NOW }));
      await store.transaction((tx) => answerOwedOffer(tx, { owedId: owed.id, familyId, answer: "yes", today: TODAY, now: NOW }));
      expect(slot!.date).toBe("2026-11-08");
      // Then the school cancels the class that new date is in.
      await store.transaction((tx) => cancelClassDate(tx, { classId: "mad-sun-0930-pier", date: "2026-11-08", reason: "The pool heater is out (sample)", now: NOW, newId: testId }));
    });
    render(<HomeScreen />);
    expect(flat((await screen.findByTestId("home-lead")).textContent)).not.toContain("in place of");
    cleanup();
    render(<LessonDatesScreen />);
    expect(flat((await screen.findAllByTestId("cancelled-day"))[0].textContent)).toBe(
      "Sunday, November 1CancelledWe cancelled this lesson. Coach Dev is away that day (sample). We cancelled its new date on Sunday, November 8 too. Messages says what's next.",
    );
    expect(screen.queryByTestId("owed-day")).toBeNull();
    cleanup();
    render(<MessagesScreen />);
    const cards = (await screen.findAllByTestId("school-cancelled")).map((c) => flat(c.textContent));
    expect(cards.some((c) => c.includes("You said yes on Friday, October 30 to Sunday, November 8 at 9:30 am. We cancelled that day too. The pool heater is out (sample)."))).toBe(true);
    expect(cards.some((c) => c.startsWith("We cancelled Mia's lessonSunday, November 8 at 9:30 am, Madison."))).toBe(true);
    cleanup();
    render(<BillsScreen />);
    expect(flat((await screen.findAllByTestId("cancelled-billed"))[0].textContent)).toBe(
      "November 1: we cancelled this lesson, and then its new date, Sunday, November 8, too. It stays on the bill for now.",
    );
  });

  it("a fill-in marked held has happened: Lesson dates say so and Your first lesson moves on", async () => {
    const store = freshStore();
    // Remy's only class is Wednesdays at 4:00 at Buckhead; Remy will miss the first one, November 11, and Coach Wren's Sunday private time is the fill-in.
    const { familyId } = await signUp(store, completeDraft({ id: "draft-remy", poolId: "pool-buckhead", kids: [{ firstName: "Remy", birth: "2021-06-01", stage: "shallows", booking: { kind: "class", timeId: "buc-wed-1600-shallows" } }] }));
    await act(async () => {
      const data = await store.snapshot();
      const remy = data.children.find((c) => c.familyId === familyId)!;
      const wed = data.enrollments.find((e) => e.childRecordId === remy.id)!;
      const note = await store.transaction((tx) => sendNote(tx, { familyId, childRecordId: remy.id, kind: "miss", enrollmentId: wed.id, lessonDate: "2026-11-11", today: TODAY, now: NOW, newId: testId }));
      const f = await store.transaction((tx) => sendFillIn(tx, { noteId: note.id, timeId: "buc-eval-sun-1130", date: "2026-11-15", today: TODAY, now: NOW, newId: testId }));
      await store.transaction((tx) => answerFillIn(tx, { fillInId: f.id, familyId, answer: "yes", today: TODAY, now: NOW }));
      await store.transaction((tx) => pretendFirstLesson(tx, { familyId, now: NOW, newId: testId }));
    });
    render(<LessonDatesScreen />);
    expect(flat((await screen.findByTestId("missing-day")).textContent)).toBe("Wednesday, November 11Not comingYou sent a note that Remy will miss it. Remy's fill-in on Sunday, November 15 has happened.");
    expect(screen.queryByTestId("fill-in-day")).toBeNull();
    cleanup();
    render(<FirstLessonScreen />);
    expect(flat((await screen.findByTestId("lesson-ticket")).textContent)).toContain("Wednesday, November 18");
  });

  it("once the missed day has passed, its fill-in still shows on Lesson dates, in date order", async () => {
    const store = freshStore();
    const { familyId } = await signUp(store, completeDraft({ id: "draft-remy", poolId: "pool-buckhead", kids: [{ firstName: "Remy", birth: "2021-06-01", stage: "shallows", booking: { kind: "class", timeId: "buc-wed-1600-shallows" } }] }));
    await act(async () => {
      const data = await store.snapshot();
      const remy = data.children.find((c) => c.familyId === familyId)!;
      const wed = data.enrollments.find((e) => e.childRecordId === remy.id)!;
      const note = await store.transaction((tx) => sendNote(tx, { familyId, childRecordId: remy.id, kind: "miss", enrollmentId: wed.id, lessonDate: "2026-11-11", today: TODAY, now: NOW, newId: testId }));
      const f = await store.transaction((tx) => sendFillIn(tx, { noteId: note.id, timeId: "buc-eval-sun-1130", date: "2026-11-15", today: TODAY, now: NOW, newId: testId }));
      await store.transaction((tx) => answerFillIn(tx, { fillInId: f.id, familyId, answer: "yes", today: TODAY, now: NOW }));
    });
    // Thursday, November 12: the missed Wednesday has passed.
    vi.setSystemTime(new Date("2026-11-12T17:00:00Z"));
    render(<HomeScreen />);
    expect(flat((await screen.findByTestId("home-lead")).textContent)).toContain("Sunday, November 15");
    cleanup();
    render(<LessonDatesScreen />);
    const list = within(await screen.findByTestId("lesson-dates")).getAllByRole("listitem").map((li) => flat(li.textContent));
    expect(list.slice(0, 2)).toEqual(["Fill-inSunday, November 15 at 11:30 am with Coach WrenA fill-in for the lesson on Wednesday, November 11.", "Wednesday, November 18"]);
  });
});

describe("a family with nothing ahead", () => {
  it("after the free evaluation, Your first lesson says nothing is coming up yet and points to adding a class; Lesson dates say when it was", async () => {
    const store = freshStore();
    const { familyId } = await signUp(
      store,
      completeDraft({ id: "draft-ivy", kids: [{ firstName: "Ivy", birth: "2024-06-15", stage: "evaluation", booking: { kind: "evaluation", timeId: "mad-eval-sun-1100" } }], payment: "hold" }),
    );
    await act(async () => void (await store.transaction((tx) => pretendFirstLesson(tx, { familyId, now: NOW, newId: testId }))));
    render(<FirstLessonScreen />);
    expect(await screen.findByRole("heading", { level: 1, name: "Your next lesson" })).toBeInTheDocument();
    expect(flat(screen.getByTestId("nothing-ahead").textContent)).toBe("No lesson is coming up yet.");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Add a child or a class" })));
    expect(pushes[pushes.length - 1]).toBe("/family/add");
    expect(screen.queryByRole("button", { name: "Sign up for lessons" })).toBeNull();
    cleanup();
    render(<LessonDatesScreen />);
    expect(flat((await screen.findByTestId("evaluation-done")).textContent)).toBe("The free evaluation was Sunday, November 1.");
  });
});

describe("one-off lessons and offers, as each screen says them", () => {
  /** Coach Dev's Sunday 9:30 class becomes a one-place Shallows class, so Mia's new date or fill-in can be a class slot. */
  const devShallows = (store: LocalStore) => act(async () => void (await store.transaction((tx) => tx.update("classes", "mad-sun-0930-pier", { stageId: "shallows", openSpots: 1, capacity: 1 }))));

  /** Mia's November 1 lesson is cancelled; she says yes to a new date, Sunday, November 8 at 11:00. */
  async function miaNewDate(store: LocalStore, familyId: string, cancelled = "2026-11-01", offered = "2026-11-08") {
    return act(async () => {
      const [owed] = await store.transaction((tx) => cancelClassDate(tx, { classId: "mad-sun-1000-shallows", date: cancelled, reason: "Coach Dev is away that day (sample)", now: NOW, newId: testId }));
      await store.transaction((tx) => sendOwedOffer(tx, { owedId: owed.id, timeId: "mad-eval-sun-1100", date: offered, today: TODAY, now: NOW }));
      await store.transaction((tx) => answerOwedOffer(tx, { owedId: owed.id, familyId, answer: "yes", today: TODAY, now: NOW }));
      return owed;
    });
  }

  it("a new date kept after the family moves on shows on Lesson dates; one for a lesson after they moved is off, and Messages says why", async () => {
    const store = freshStore();
    const { familyId } = await signUp(store);
    await miaNewDate(store, familyId);
    await act(async () => {
      const data = await store.snapshot();
      const mia = data.children.find((c) => c.familyId === familyId)!;
      const sunday = data.enrollments.find((e) => e.childRecordId === mia.id)!;
      await store.transaction((tx) => bookTime(tx, { familyId, childRecordId: mia.id, booking: { kind: "class", timeId: "buc-wed-1600-shallows" }, poolId: "pool-buckhead", today: TODAY, now: NOW, newId: testId, alone: true }));
      // Mia leaves her Sunday class on Monday, November 2, after the cancelled lesson.
      await store.transaction((tx) => leaveClass(tx, sunday.id, "2026-11-02"));
    });
    vi.setSystemTime(new Date("2026-11-02T17:00:00Z"));
    render(<LessonDatesScreen />);
    const rows = within(await screen.findByTestId("lesson-dates")).getAllByRole("listitem").map((li) => flat(li.textContent));
    expect(rows[0]).toBe("New dateSunday, November 8 at 11:00 am with Coach DevIn place of the lesson we cancelled on Sunday, November 1.");
    cleanup();

    // Another family moves before its cancelled lesson: nothing is owed, and the card says so.
    vi.setSystemTime(new Date(NOW));
    const other = freshStore();
    const second = await signUp(other);
    await miaNewDate(other, second.familyId, "2026-11-08", "2026-11-15");
    await act(async () => {
      const sunday = (await other.snapshot()).enrollments.find((e) => e.familyId === second.familyId)!;
      await other.transaction((tx) => leaveClass(tx, sunday.id, TODAY));
    });
    render(<MessagesScreen />);
    expect(flat((await screen.findByTestId("offer-status")).textContent)).toBe("Mia's class there ended before this lesson, so it isn't on your bill, and no new date is owed.");
  });

  it("a credit after a new date was cancelled too names the lesson that comes off the bill", async () => {
    const store = freshStore();
    await devShallows(store);
    const { familyId } = await signUp(store);
    await act(async () => {
      const [owed] = await store.transaction((tx) => cancelClassDate(tx, { classId: "mad-sun-1000-shallows", date: "2026-11-01", reason: "x", now: NOW, newId: testId }));
      await store.transaction((tx) => sendOwedOffer(tx, { owedId: owed.id, timeId: "mad-sun-0930-pier", date: "2026-11-08", today: TODAY, now: NOW }));
      await store.transaction((tx) => answerOwedOffer(tx, { owedId: owed.id, familyId, answer: "yes", today: TODAY, now: NOW }));
      const [again] = await store.transaction((tx) => cancelClassDate(tx, { classId: "mad-sun-0930-pier", date: "2026-11-08", reason: "y", now: NOW, newId: testId }));
      await store.transaction((tx) => tx.update("owedLessons", again.id, { creditApprovedAt: NOW, creditApprovedBy: "the owner" }));
    });
    render(<MessagesScreen />);
    const credited = (await screen.findAllByTestId("offer-status")).map((p) => flat(p.textContent)).find((t) => t.includes("approved a credit"));
    expect(credited).toBe("No date with Coach Dev was open, so the owner approved a credit. The lesson on Sunday, November 1 comes off your bill.");
    cleanup();
    render(<BillsScreen />);
    expect(flat((await screen.findAllByTestId("cancelled-billed"))[0].textContent)).toBe("November 1: we cancelled this lesson and credited it, so it isn't billed.");
  });

  it("a family on a waitlist only isn't asked to sign up: Lesson dates and Your first lesson say nothing is coming up yet", async () => {
    const store = freshStore();
    await signUp(store, completeDraft({ id: "draft-wait", kids: [{ firstName: "Mia", birth: "2022-07-30", stage: "shallows", booking: null, waitlist: ["mad-wed-1630-shallows"] }] }));
    render(<LessonDatesScreen />);
    expect(flat((await screen.findByTestId("nothing-ahead")).textContent)).toBe("No lesson is coming up yet. Mia is on a waitlist; Home shows where that stands.");
    expect(screen.getByRole("button", { name: "Add a child or a class" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign up for lessons" })).toBeNull();
    cleanup();
    render(<FirstLessonScreen />);
    expect(flat((await screen.findByTestId("nothing-ahead")).textContent)).toBe("No lesson is coming up yet. Mia is on a waitlist; Home shows where that stands.");
  });

  it("the owner's card and Done say when the school closed a date, and what each new date was for", async () => {
    const store = freshStore();
    await devShallows(store);
    const { familyId } = await signUp(store);
    await act(async () => {
      const [owed] = await store.transaction((tx) => cancelClassDate(tx, { classId: "mad-sun-1000-shallows", date: "2026-11-01", reason: "x", now: NOW, newId: testId }));
      await store.transaction((tx) => sendOwedOffer(tx, { owedId: owed.id, timeId: "mad-sun-0930-pier", date: "2026-11-08", today: TODAY, now: NOW }));
      // The school cancels that day before the family answers.
      await store.transaction((tx) => cancelClassDate(tx, { classId: "mad-sun-0930-pier", date: "2026-11-08", reason: "y", now: NOW, newId: testId }));
      expect(familyId).toBeTruthy();
    });
    render(<InboxScreen />);
    const card = await screen.findByTestId("inbox-owed");
    expect(flat(within(card).getByTestId("owed-earlier").textContent)).toBe("Offered Sunday, November 8: we cancelled that day before they answered, so it doesn't count.");
    expect(flat(card.textContent)).toContain("Pick one date to offer.");
    const done = flat(screen.getByTestId("inbox-done").textContent);
    expect(done).toContain("Offered Mia a new date, Sunday, November 8, for the cancelled lesson on Sunday, November 1. Closed before they answered: we cancelled that day.");
  });

  it("the different-time card says when the child has no weekly class, or an offer from another waitlist already waits", async () => {
    const store = freshStore();
    const ivy = await signUp(
      store,
      completeDraft({ id: "draft-ivy", kids: [{ firstName: "Ivy", birth: "2024-06-15", stage: "evaluation", booking: { kind: "evaluation", timeId: "mad-eval-sun-1100" } }], payment: "hold" }),
    );
    const ada = await signUp(store, adaDraft());
    await act(async () => {
      let data = await store.snapshot();
      const ivyChild = data.children.find((c) => c.familyId === ivy.familyId)!;
      await store.transaction((tx) => sendNote(tx, { familyId: ivy.familyId, childRecordId: ivyChild.id, kind: "move", today: TODAY, now: NOW, newId: testId }));
      // Ada's class waitlist gets an offer; then her family asks for a different time.
      await store.transaction((tx) => pretendFamilyLeft(tx, { today: TODAY }));
      data = await store.snapshot();
      const item = waitlistItems(data, TODAY).find((i) => i.family.id === ada.familyId)!;
      await store.transaction((tx) => sendWaitlistOffer(tx, { entryId: item.entry.id, classId: "buc-sun-0900-cove", inPlaceOfEnrollmentId: item.ownClasses[0].enrollment.id, today: TODAY, now: NOW, newId: testId }));
      await store.transaction((tx) => sendNote(tx, { familyId: ada.familyId, childRecordId: item.child.id, kind: "move", today: TODAY, now: NOW, newId: testId }));
    });
    render(<InboxScreen />);
    const notes = (await screen.findAllByTestId("inbox-note")).map((n) => flat(n.textContent));
    expect(notes.find((t) => t.startsWith("Ivy"))).toContain("Ivy has no weekly class to replace.");
    expect(notes.find((t) => t.startsWith("Ada"))).toContain("An offer for Ada is already waiting for the family's answer, by Friday, November 6.");
  });

  it("a switch to a class at another price shows both prices under Now and New", async () => {
    const store = freshStore();
    const { familyId } = await signUp(store);
    await act(async () => {
      await store.transaction((tx) => tx.update("classes", "mad-wed-1630-shallows", { openSpots: 1, lessonTypeId: "lt-mad-private" }));
      const data = await store.snapshot();
      const mia = data.children.find((c) => c.familyId === familyId)!;
      const note = await store.transaction((tx) => sendNote(tx, { familyId, childRecordId: mia.id, kind: "move", today: TODAY, now: NOW, newId: testId }));
      const own = data.enrollments.find((e) => e.childRecordId === mia.id)!;
      await store.transaction((tx) => offerDifferentTime(tx, { noteId: note.id, classId: "mad-wed-1630-shallows", inPlaceOfEnrollmentId: own.id, today: TODAY, now: NOW, newId: testId }));
    });
    render(<MessagesScreen />);
    const both = flat((await screen.findByTestId("now-and-new")).textContent);
    expect(both).toMatch(/^NowSundays at 10:00 am, Madison, Coach DevBank draft\$34\.00 a lessonCard\$35\.00 a lessonEnds the day you say yes\.NewWednesdays at 4:30 pm, Madison, Coach TamsinBank draft\$\d+\.\d\d a lessonCard\$\d+\.\d\d a lesson$/);
    expect(both).not.toContain("Same as now.");
  });

  it("a booked date whose day is closed, or a fill-in the school cancels, says so on Lesson dates, Bills, Messages and Your first lesson", async () => {
    const store = freshStore();
    await devShallows(store);
    const { familyId } = await signUp(store);
    await miaNewDate(store, familyId);
    await act(async () => {
      // The pool closes Sunday, November 8 (sample): the new date at 11:00 is off.
      await store.transaction((tx) => tx.add("closures", { id: "closure-test", poolId: "pool-madison", date: "2026-11-08", reason: "The pool is closed for a repair (sample)" }));
    });
    render(<LessonDatesScreen />);
    expect(flat((await screen.findAllByTestId("cancelled-day"))[0].textContent)).toContain("The pool is closed for its new date on Sunday, November 8.");
    cleanup();
    render(<BillsScreen />);
    expect(flat((await screen.findAllByTestId("cancelled-billed"))[0].textContent)).toBe(
      "November 1: we cancelled this lesson. The pool is closed on its new date, Sunday, November 8. It stays on the bill for now.",
    );
    cleanup();
    render(<FirstLessonScreen />);
    expect(flat((await screen.findAllByTestId("lesson-ticket"))[0].textContent)).not.toContain("11:00 am");

    // A fill-in the family said yes to, in a class slot the school then cancels.
    const other = freshStore();
    await devShallows(other);
    const second = await signUp(other);
    await act(async () => {
      const data = await other.snapshot();
      const mia = data.children.find((c) => c.familyId === second.familyId)!;
      const sunday = data.enrollments.find((e) => e.childRecordId === mia.id)!;
      const note = await other.transaction((tx) => sendNote(tx, { familyId: second.familyId, childRecordId: mia.id, kind: "miss", enrollmentId: sunday.id, lessonDate: "2026-11-01", today: TODAY, now: NOW, newId: testId }));
      const f = await other.transaction((tx) => sendFillIn(tx, { noteId: note.id, timeId: "mad-sun-0930-pier", date: "2026-11-08", today: TODAY, now: NOW, newId: testId }));
      await other.transaction((tx) => answerFillIn(tx, { fillInId: f.id, familyId: second.familyId, answer: "yes", today: TODAY, now: NOW }));
      await other.transaction((tx) => cancelClassDate(tx, { classId: "mad-sun-0930-pier", date: "2026-11-08", reason: "The pool heater is out (sample)", now: NOW, newId: testId }));
    });
    cleanup();
    render(<MessagesScreen />);
    expect(flat(within(await screen.findByTestId("school-fill-in")).getByTestId("offer-status").textContent)).toBe(
      "You said yes on Friday, October 30 to a fill-in on Sunday, November 8 at 9:30 am. We cancelled that day. The pool heater is out (sample).",
    );
  });
});

describe("no partner after the first month", () => {
  it("the inbox drafts the note once the first month has passed; a person sends it; Done says so", async () => {
    const store = freshStore();
    // Before Theo's first month with no partner ends (Saturday, November 7), nothing is listed.
    render(<InboxScreen />);
    expect(await screen.findByText("Nothing is waiting for a person.")).toBeInTheDocument();
    cleanup();
    vi.setSystemTime(new Date("2026-11-09T17:00:00Z"));
    render(<InboxScreen />);
    const section = await screen.findByTestId("inbox-section-partners");
    expect(within(section).getByRole("heading", { level: 2 })).toHaveTextContent("No partner after the first month");
    const card = within(section).getByTestId("inbox-partner");
    expect(flat(card.textContent)).toContain(
      "No partner in the Wednesday 5:00 pm class at Madison, with Coach Tamsin, since Wednesday, October 7. The first month at the semi-private price ended Friday, November 6.",
    );
    expect(flat(card.textContent)).toContain("The app doesn't pair anyone or change the price.");
    expect(flat(within(card).getByTestId("draft-words").textContent)).toBe(
      "Theo has had no partner in the Wednesday 5:00 pm class at Madison, with Coach Tamsin, since Wednesday, October 7. The first month at the semi-private price has passed, and we haven't found a partner yet. We'd like to talk with you about what comes next: email us at madison.sample@example.com. Nothing about Theo's class or its price changes before Wednesday, December 2.",
    );
    expect(within(card).getByTestId("draft")).toHaveTextContent("Goes to Dana Whitcombe's Messages in the app.");
    const drafted = within(card).getByTestId("draft-words").textContent;
    await act(async () => fireEvent.click(within(card).getByRole("button", { name: "Send the note (sample)" })));
    expect(screen.queryByTestId("inbox-partner")).toBeNull();
    expect(flat(screen.getByTestId("inbox-done").textContent)).toContain(
      "Sent Dana Whitcombe a note about Theo's Wednesday 5:00 pm class at Madison: no partner yet; nothing changes before Wednesday, December 2.",
    );
    // Exactly the words the person saw are what the family gets.
    expect((await store.snapshot()).partnerNotices.map((n) => n.words)).toEqual([drafted]);
  });

  it("the family reads it in Messages, and Home says no partner yet, then that nothing changes before that date", async () => {
    const store = freshStore();
    vi.setSystemTime(new Date("2026-11-09T17:00:00Z"));
    await act(async () => {
      await store.transaction((tx) => setCurrentFamily(tx, MOVING_FAMILY_ID, "moving"));
    });
    render(<HomeScreen />);
    const theo = (await screen.findAllByTestId("home-child")).find((c) => c.textContent?.includes("Theo"))!;
    expect(flat(within(theo).getByTestId("home-no-partner").textContent)).toBe(
      "No partner yet. You pay the semi-private price for the first month. If we haven't found a partner by then, we'll talk with you before anything changes.",
    );
    cleanup();
    await act(async () => {
      const theoClass = familyLessons(await store.snapshot(), MOVING_FAMILY_ID).find((l) => l.child.firstName === "Theo")!;
      await store.transaction((tx) => sendPartnerNotice(tx, { enrollmentId: theoClass.enrollment.id, today: "2026-11-09", now: "2026-11-09T17:00:00.000Z", newId: testId }));
    });
    render(<MessagesScreen />);
    const card = await screen.findByTestId("school-partner-note");
    expect(within(card).getByRole("heading", { level: 3 })).toHaveTextContent("About Theo's class");
    expect(flat(within(card).getByTestId("partner-note-words").textContent)).toContain("Nothing about Theo's class or its price changes before Wednesday, December 2.");
    expect(within(card).queryByRole("button")).toBeNull();
    expect(within(card).queryByTestId("partner-note-status")).toBeNull();
    cleanup();
    render(<HomeScreen />);
    const after = (await screen.findAllByTestId("home-child")).find((c) => c.textContent?.includes("Theo"))!;
    expect(flat(within(after).getByTestId("home-no-partner").textContent)).toBe(
      "No partner yet. We sent you a note about it in Messages: nothing about this class or its price changes before Wednesday, December 2.",
    );
    // Juniper's class has a partner: no such line.
    const juniper = (await screen.findAllByTestId("home-child")).find((c) => c.textContent?.includes("Juniper"))!;
    expect(within(juniper).queryByTestId("home-no-partner")).toBeNull();
  });
});

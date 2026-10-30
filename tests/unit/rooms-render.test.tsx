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
import { LATER_ROOM_RULES } from "@/rules/later-rooms";
import { markNoteRead, sendNote } from "@/rules/notes";
import { answerWaitlistOffer, leaveWaitlist, sendWaitlistOffer, waitlistItems } from "@/rules/offers";
import { answerOwedOffer, cancelClassDate, sendOwedOffer } from "@/rules/owed";
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
    expect(flat((await screen.findByTestId("missing-day")).textContent)).toBe("Sunday, November 8MissingWe read your note. There's no fill-in for this one.");
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
    expect(flat(within(offer).getByTestId("offer-words").textContent)).toBe(
      "A spot opened for Ada in the Sunday 9:00 am class at Buckhead, with Coach Wren. Would you like Ada to move there from the Sunday 10:00 am class? Please answer by Friday, November 6.",
    );
    expect(flat(offer.textContent)).toContain("Bank draft$36.00 a lesson");
    expect(flat(offer.textContent)).toContain("If you say yes, the first lesson there is Sunday, November 8.");
    await act(async () => fireEvent.click(within(offer).getByRole("button", { name: "Yes, book it" })));
    expect(flat((await screen.findByTestId("offer-status")).textContent)).toBe("You said yes. Ada's first lesson there is Sunday, November 8.");
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
    expect(flat((await screen.findByTestId("offer-status")).textContent)).toBe("You said yes. Mia's lesson is on Sunday, November 8 at 11:00 am with Coach Dev.");
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
    expect(flat((await screen.findByTestId("offer-status")).textContent)).toBe("You said no, thanks. Ada stays on the waitlist.");
    await act(async () => {
      const entry = (await store.snapshot()).waitlistEntries.find((w) => w.familyId === familyId)!;
      await store.transaction((tx) => leaveWaitlist(tx, { entryId: entry.id, familyId, today: TODAY }));
    });
    expect(flat((await screen.findByTestId("offer-status")).textContent)).toBe("You said no, thanks.");
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
    expect(flat(within(wait).getByTestId("draft-words").textContent)).toContain("Would you like Ada to move there from the Sunday 10:00 am class?");
    await act(async () => fireEvent.click(within(wait).getByRole("button", { name: "Send the offer (sample)" })));
    expect(await within(screen.getByTestId("inbox-waitlist")).findByTestId("inbox-waiting")).toBeInTheDocument();
    expect((await store.snapshot()).waitlistOffers).toHaveLength(1);

    // Notes from families: a person marks each one read.
    const note = screen.getByTestId("inbox-note");
    expect(flat(within(note).getByTestId("inbox-note-words").textContent)).toBe("We'd like to talk about a different lesson time for Mia.");
    // A different-time note: the person chooses to read it and offer nothing.
    await act(async () => fireEvent.click(within(note).getByRole("button", { name: "Mark as read, no offer" })));
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
    expect(flat((await within(screen.getByTestId("school-fill-in")).findByTestId("offer-status")).textContent)).toBe("You said yes. Mia's fill-in is on Sunday, November 15 at 11:00 am with Coach Dev.");
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
  it("a person picks an open time, sees the words, and sends it in place of the child's class", async () => {
    const store = freshStore();
    const { familyId } = await signUp(store, completeDraft({ id: "draft-jules", kids: [{ firstName: "Jules", birth: "2023-06-15", stage: "pier", booking: { kind: "class", timeId: "mad-sun-0930-pier" } }] }));
    await act(async () => {
      const jules = (await store.snapshot()).children.find((c) => c.familyId === familyId)!;
      await store.transaction((tx) => sendNote(tx, { familyId, childRecordId: jules.id, kind: "move", today: TODAY, now: NOW, newId: testId }));
    });
    render(<InboxScreen />);
    const note = await screen.findByTestId("inbox-note");
    expect(flat(note.textContent)).toContain("A different time: pick one to offer, or none.");
    expect(within(note).queryByTestId("draft")).toBeNull();
    await act(async () => fireEvent.click(within(note).getByTestId("different-time-buc-sun-0930-pier")));
    expect(flat(within(note).getByTestId("draft-words").textContent)).toContain("Would you like Jules to move there from the Sunday 9:30 am class?");
    await act(async () => fireEvent.click(within(note).getByRole("button", { name: "Send the offer (sample)" })));
    expect(screen.queryByTestId("inbox-note")).toBeNull();
    expect(within(await screen.findByTestId("inbox-waitlist")).getByTestId("inbox-waiting")).toHaveTextContent("Offer sent.");
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
      "Sunday, November 1MissingWe read your note. There's no fill-in for this one.",
      "Sunday, November 8MissingYou sent a note that Mia will miss it. Messages has a fill-in for you to answer.",
    ]);
    cleanup();
    render(<MessagesScreen />);
    const card = await screen.findByTestId("school-fill-in");
    await act(async () => fireEvent.click(within(card).getByRole("button", { name: "No, thanks" })));
    expect(flat((await within(screen.getByTestId("school-fill-in")).findByTestId("offer-status")).textContent)).toBe("You said no, thanks.");
    cleanup();
    render(<LessonDatesScreen />);
    expect(flat((await screen.findAllByTestId("missing-day"))[1].textContent)).toBe("Sunday, November 8MissingYou sent a note that Mia will miss it. You said no, thanks, to the fill-in.");
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
      "Sunday, November 1MissingYou sent a note that Mia will miss it. The fill-in we offered closed with no answer.",
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
    // Six from rulings 1 to 3, and the fill-in rule from ruling 5.
    expect(built).toHaveLength(7);
    expect(screen.getAllByText("Built")).toHaveLength(7);
    for (const r of built) expect(screen.getByText(`In ${r.builtIn}.`)).toBeInTheDocument();
  });
});

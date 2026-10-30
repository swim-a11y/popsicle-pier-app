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
import { setCurrentFamily, signAndSave } from "@/rules/booking";
import { LATER_ROOM_RULES } from "@/rules/later-rooms";
import { markNoteRead, sendNote } from "@/rules/notes";
import { sendWaitlistOffer, waitlistItems } from "@/rules/offers";
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
    expect(flat((await screen.findByTestId("missing-day")).textContent)).toBe("Sunday, November 8MissingYou sent a note that Mia will miss it.");
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
    expect(flat(cancelledDay.textContent)).toContain(
      "Sunday, November 1CancelledWe cancelled this lesson. Coach Dev is away that day (sample). Its new date is Sunday, November 8 at 11:00 am with Coach Dev.",
    );
    // The new date sits right under the cancelled one, in Mia's own card.
    expect(flat(within(cancelledDay).getByTestId("owed-day").textContent)).toBe("Sunday, November 8 at 11:00 amNew date");
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
    expect(flat(line.textContent)).toContain("On the waitlist for Sundays at 9:00 am.");
    await act(async () => fireEvent.click(within(line).getByRole("button", { name: "Leave this waitlist" })));
    expect(flat(screen.getByTestId("home-waitlist").textContent)).toContain("Take Ada off the waitlist for Sundays at 9:00 am?");
    await act(async () => fireEvent.click(within(screen.getByTestId("home-waitlist")).getByRole("button", { name: "Stay on it" })));
    expect((await store.snapshot()).waitlistEntries.filter((w) => w.familyId === familyId)).toHaveLength(1);
    await act(async () => fireEvent.click(within(screen.getByTestId("home-waitlist")).getByRole("button", { name: "Leave this waitlist" })));
    await act(async () => fireEvent.click(within(screen.getByTestId("home-waitlist")).getByRole("button", { name: "Leave the waitlist" })));
    expect((await store.snapshot()).waitlistEntries.filter((w) => w.familyId === familyId)).toEqual([]);
    expect(screen.queryByTestId("home-waitlist")).toBeNull();
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
    expect(flat(within(lead).getByTestId("home-in-place").textContent)).toBe("In place of the lesson on Wednesday, November 11.");
    cleanup();
    render(<FirstLessonScreen />);
    const ticket = await screen.findByTestId("lesson-ticket");
    expect(flat(ticket.textContent)).toContain("Sunday, November 15");
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
    await act(async () => fireEvent.click(within(note).getByRole("button", { name: "Mark as read" })));
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
    expect(flat(note.textContent)).toContain("A fill-in: one date with Coach Dev the week after. Pick one, or none.");
    expect(within(note).queryByTestId("draft")).toBeNull();
    await act(async () => fireEvent.click(within(note).getByTestId("fill-in-slot-2026-11-15-1100")));
    expect(flat(within(note).getByTestId("draft-words").textContent)).toBe(
      "You told us Mia will miss Sunday, November 8. We can offer a fill-in on Sunday, November 15 at 11:00 am with Coach Dev at Madison. Does that work? Please answer by Saturday, November 14.",
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
    expect(flat(missed.textContent)).toContain("You sent a note that Mia will miss it. Mia's fill-in is just below.");
    expect(flat(within(missed).getByTestId("fill-in-day").textContent)).toBe("Sunday, November 15 at 11:00 am, Coach DevFill-in");
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

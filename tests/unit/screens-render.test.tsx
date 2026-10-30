import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { completeDraft, freshStore, NOW, testId, TODAY } from "./helpers";

vi.mock("next/navigation", async () => (await import("./helpers")).navigationMock());
vi.mock("next/link", async () => (await import("./helpers")).linkMock());

import { FirstLessonScreen } from "@/components/screens/first-lesson";
import { HomeScreen } from "@/components/screens/home";
import { LessonDatesScreen } from "@/components/screens/lesson-dates";
import { MoveOverClasses, MoveOverDetails, MoveOverPeople } from "@/components/screens/move-over/checks";
import { MoveOverEmail } from "@/components/screens/move-over/email";
import { OwnerReleasesScreen } from "@/components/screens/owner-releases";
import { ProgressScreen } from "@/components/screens/progress";
import { StaffScreen } from "@/components/screens/staff";
import { LocalStore } from "@/data/store";
import { commitAdd, newAddDraft } from "@/rules/add";
import { signAndSave, setCurrentFamily } from "@/rules/booking";
import { LATER_ROOM_RULES, LATER_ROOMS } from "@/rules/later-rooms";
import { pretendFirstLesson } from "@/sandbox/pretend-first-lesson";
import { MOVING_FAMILY_ID } from "@/sandbox/seed";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function signUp(store: LocalStore, draft = completeDraft({})) {
  await store.transaction((tx) => tx.add("signUpDrafts", draft));
  return store.transaction((tx) => signAndSave(tx, { draft, today: TODAY, now: NOW, browserName: "Chrome", newId: testId }));
}

describe("parent screens", () => {
  it("skeleton rows until stored data loads", async () => {
    freshStore();
    render(<HomeScreen />);
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
    expect(screen.queryByText(/nothing/i)).toBeNull();
    expect(await screen.findByRole("heading", { name: "Welcome to Popsicle Pier Swim School" })).toBeInTheDocument();
    expect(screen.queryByTestId("skeleton")).toBeNull();
  });

  it("Home before and after the first lesson", async () => {
    const store = freshStore();
    const { familyId } = await signUp(store);
    render(<HomeScreen />);
    const lead = await screen.findByTestId("home-lead");
    expect(lead).toHaveTextContent("Your first lesson");
    expect(lead).toHaveTextContent("Sunday, November 1, 10:00 am");
    const child = screen.getByTestId("home-child");
    expect(within(child).getByTestId("home-stage")).toHaveTextContent("The Shallows");
    expect(within(child).getByText(/Sundays at 10:00 am, Madison, Coach Dev/)).toBeInTheDocument();
    expect(within(child).getByTestId("home-prices")).toHaveTextContent(/^Bank draft\s*\$34\.00 a lesson\s*Card\s*\$35\.00 a lesson$/);
    expect(screen.getByTestId("home-release")).toHaveTextContent("You signed version 2 on October 30, 2026.");
    expect(screen.getByTestId("home-pay")).toHaveTextContent("Bank draft, with a backup card");
    // Built now: the card opens the add flow (it was a coming-next card in the first build).
    expect(within(screen.getByTestId("add-child-card")).getByRole("button", { name: "Add a child or a class" })).toBeInTheDocument();
    cleanup();
    await act(() => store.transaction((tx) => pretendFirstLesson(tx, { familyId, now: NOW, newId: testId })));
    render(<HomeScreen />);
    const after = await screen.findByTestId("home-lead");
    expect(within(after).getByTestId("how-it-went")).toHaveTextContent("How it went for Mia");
  });

  it("Home gives each child their own time and coach on the same day", async () => {
    const store = freshStore();
    await signUp(
      store,
      completeDraft({
        poolId: "pool-buckhead",
        kids: [
          { firstName: "Ada", birth: "2020-06-01", stage: "cove", booking: { kind: "class", timeId: "buc-sun-1000-cove" } },
          { firstName: "Leo", birth: "2023-05-01", stage: "pier", booking: { kind: "class", timeId: "buc-sun-0930-pier" } },
        ],
      }),
    );
    render(<HomeScreen />);
    const lead = await screen.findByTestId("home-lead");
    expect(lead).toHaveTextContent("Sunday, November 8");
    const lines = within(lead).getAllByRole("listitem").map((li) => li.textContent?.replace(/\s+/g, " "));
    expect(lines).toEqual(["Leo, 9:30 am with Coach Wren", "Ada, 10:00 am with Coach Ines"]);
  });

  it("Your first lesson shows where, what and who", async () => {
    const store = freshStore();
    await signUp(
      store,
      completeDraft({
        listed: [{ firstName: "Rose", relationship: "grandparent" }],
        kids: [
          { firstName: "Mia", birth: "2022-07-30", stage: "shallows", booking: { kind: "class", timeId: "mad-sun-1000-shallows" } },
          { firstName: "Ivy", birth: "2024-03-01", stage: "pier", booking: { kind: "class", timeId: "mad-sun-0900-water" } },
        ],
      }),
    );
    const { container } = render(<FirstLessonScreen />);
    expect(await screen.findByRole("heading", { name: "Your first lesson" })).toBeInTheDocument();
    const tickets = screen.getAllByTestId("lesson-ticket");
    expect(tickets).toHaveLength(2);
    expect(tickets[0]).toHaveTextContent("Ivy");
    expect(within(tickets[0]).getByTestId("lesson-when")).toHaveTextContent("Sunday, November 1");
    expect(within(tickets[0]).getByTestId("lesson-time")).toHaveTextContent("9:00 am");
    expect(within(tickets[0]).getByTestId("lesson-where")).toHaveTextContent("Madison, Coach Marisol");
    expect(tickets[1]).toHaveTextContent("The lesson runs 27 minutes.");
    // Shared notes once.
    expect(screen.getAllByRole("heading", { name: "Getting there" })).toHaveLength(1);
    expect(screen.getByTestId("parking")).toHaveTextContent("Park in the side lot");
    expect(screen.getByTestId("door")).toHaveTextContent("blue side door");
    expect(screen.getByTestId("arrive")).toHaveTextContent("Arrive 10 minutes early");
    expect(screen.getByText("Every child 3 and under, and any child who isn't toilet-trained, wears a snug reusable swim diaper.")).toBeInTheDocument();
    expect(screen.getByText("Bring your suit, you're in the water too.")).toBeInTheDocument();
    const who = screen.getByTestId("who-stays");
    expect(who).toHaveTextContent("You or a signed listed adult stay at the pool the whole lesson, or the lesson doesn't start. No drop-off.");
    expect(within(who).getByTestId("listed-adult")).toHaveTextContent("Rose, grandparent");
    expect(within(who).getByTestId("listed-adult")).toHaveTextContent("Waiting");
    expect(within(who).getByTestId("listed-adult")).toHaveTextContent("Signs on paper at the check-in desk before their first lesson.");
    expect(who).toHaveTextContent("Brothers and sisters wait on deck with you.");
    expect(who).toHaveTextContent("Every lesson is recorded for coaching and quality work.");
    expect(screen.getByTestId("email-us")).toHaveTextContent("Need to miss, move or stop? Email us at madison.sample@example.com.");
    expect(container.querySelector('a[href^="mailto:"], a[href^="tel:"], a[href^="sms:"]')).toBeNull();
    expect(screen.getAllByText("SAMPLE").length).toBeGreaterThanOrEqual(3);
  });

  it("Progress shows the not-yet line before the first lesson", async () => {
    const store = freshStore();
    const { familyId } = await signUp(store);
    render(<ProgressScreen />);
    expect(await screen.findByTestId("note-not-yet")).toHaveTextContent("Your first 'How it went' note comes after Mia's first lesson on Sunday, November 1.");
    expect(screen.getByText("Lesson clips come in a later version.")).toBeInTheDocument();
    cleanup();
    // A draft note never reaches the screen.
    await act(() =>
      store.transaction((tx) =>
        tx.add("lessonNotes", {
          id: "draft-1",
          familyId,
          childRecordId: tx.list("children").find((c) => c.familyId === familyId)!.id,
          attendanceMarkId: "none",
          poolId: "pool-madison",
          lessonDate: "2026-11-01",
          instructorFirstName: "Dev",
          stageId: "shallows",
          lineToday: "A draft line from the coach.",
          lineNext: "Not approved yet.",
          templateId: "x",
          status: "draft",
          approvedBy: null,
          approvedAt: null,
          createdAt: NOW,
        }),
      ),
    );
    render(<ProgressScreen />);
    await screen.findByTestId("note-not-yet");
    expect(screen.queryByText("A draft line from the coach.")).toBeNull();
    expect(screen.queryByTestId("how-it-went")).toBeNull();
  });
});

describe("lesson dates", () => {
  it("each swimmer's weeks ahead, closed days marked and not billed", async () => {
    const store = freshStore();
    await signUp(store);
    render(<LessonDatesScreen />);
    const section = await screen.findByTestId("lesson-dates");
    expect(section).toHaveTextContent("Mia");
    expect(section).toHaveTextContent("Sundays at 10:00 am, Madison, Coach Dev");
    const closed = within(section).getAllByTestId("closed-day");
    expect(closed[0]).toHaveTextContent("Sunday, November 29");
    expect(closed[0]).toHaveTextContent("Closed");
    expect(closed[0]).toHaveTextContent("Closed for the holiday weekend (sample)");
    // What a closed day means is said once, above the dates.
    expect(screen.getByText("The next few weeks for each swimmer. On a closed day there's no lesson, and it isn't billed.")).toBeInTheDocument();
    expect(within(section).getAllByTestId("lesson-day")[0]).toHaveTextContent("Sunday, November 1");
    expect(screen.getByText("Need to miss, move or stop? Email us at madison.sample@example.com.")).toBeInTheDocument();
  });
});

describe("a family at both pools", () => {
  it("gets each pool's own directions and email line", async () => {
    const store = freshStore();
    const { familyId } = await signUp(store);
    // A brother added at Buckhead: the family now has lessons at both pools.
    const draft = newAddDraft({ familyId, mode: "child", childRecordId: null, poolId: "pool-buckhead", kidKey: "leo", now: NOW });
    await act(() =>
      store.transaction((tx) => {
        tx.add("addDrafts", {
          ...draft,
          kid: { ...draft.kid, firstName: "Leo", birthMonth: "5", birthDay: "1", birthYear: "2023", stage: "pier", booking: { kind: "class", timeId: "buc-sun-0930-pier" } },
          answers: { custody: "no", health: "no", research: false, marketing: false, underwater: false },
        });
        return commitAdd(tx, { draftId: draft.id, today: TODAY, now: "2026-10-30T16:00:00.000Z", newId: testId, browserName: "Chrome" });
      }),
    );
    render(<FirstLessonScreen />);
    expect(await screen.findByRole("heading", { name: "Getting there: Madison" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Getting there: Buckhead" })).toBeInTheDocument();
    expect(screen.getAllByTestId("at-a-glance")).toHaveLength(2);
    const lines = screen.getAllByTestId("email-us").map((p) => p.textContent);
    expect(lines).toEqual([
      "Need to miss, move or stop a Madison lesson? Email us at madison.sample@example.com.",
      "Need to miss, move or stop a Buckhead lesson? Email us at buckhead.sample@example.com.",
    ]);
    cleanup();
    render(<LessonDatesScreen />);
    await screen.findAllByTestId("lesson-dates");
    expect(screen.getAllByTestId("email-us").map((p) => p.textContent)).toEqual(lines);
  });
});

describe("owner", () => {
  it("release versions show date, What changed, fingerprint and count", async () => {
    const store = freshStore();
    const data = await store.snapshot();
    render(<OwnerReleasesScreen />);
    const versions = await screen.findAllByTestId("release-version");
    expect(versions).toHaveLength(2);
    const v2 = versions[0];
    expect(v2).toHaveTextContent("Version 2");
    expect(v2).toHaveTextContent("Current");
    expect(within(v2).getByTestId("version-date")).toHaveTextContent("Published September 15, 2026");
    for (const line of data.releaseVersions.find((v) => v.id === "v2")!.whatChanged) expect(v2).toHaveTextContent(line);
    expect(within(v2).getByTestId("version-fingerprint")).toHaveTextContent(data.releaseVersions.find((v) => v.id === "v2")!.fingerprint);
    expect(within(v2).getByTestId("version-count")).toHaveTextContent("Signed by 2 sample families");
    expect(within(versions[1]).getByTestId("version-count")).toHaveTextContent("Signed by 2 sample families");
    // Read-only: no inputs or buttons that change anything on the page body.
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });
});

describe("staff", () => {
  it("one page lists the later rooms and their rules from the rules file", async () => {
    freshStore();
    render(<StaffScreen />);
    expect(screen.getByRole("heading", { level: 1, name: "Staff side, coming later" })).toBeInTheDocument();
    for (const room of LATER_ROOMS) {
      expect(screen.getByRole("heading", { name: room.name })).toBeInTheDocument();
      expect(screen.getByText(room.line)).toBeInTheDocument();
    }
    for (const name of ["Schedule", "Deck", "Money", "Office and Owner", "Progress and Video"]) expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    expect(screen.getAllByText("Rules this room will follow").length).toBeGreaterThanOrEqual(5);
    for (const rule of LATER_ROOM_RULES) expect(screen.getByText(rule.text)).toBeInTheDocument();
    // The rules file holds the owner's words exactly.
    const claude = readFileSync("CLAUDE.md", "utf8");
    const section = claude.slice(claude.indexOf("## RULES FOR LATER ROOMS"));
    for (const rule of LATER_ROOM_RULES) expect(section).toContain(`- ${rule.text}`);
    expect(LATER_ROOM_RULES).toHaveLength(section.split("\n").filter((l) => l.startsWith("- ")).length);
    // No live view, no per-role screens.
    expect(screen.queryByRole("button", { name: /live/i })).toBeNull();
  });
});

describe("moving over", () => {
  it("shows what the school already has, never retyped", async () => {
    const store = freshStore();
    await act(() => store.transaction((tx) => setCurrentFamily(tx, MOVING_FAMILY_ID, "moving")));
    const details = render(<MoveOverDetails />);
    const card = await screen.findByTestId("move-details");
    expect(card).toHaveTextContent("Dana Whitcombe");
    expect(card).toHaveTextContent("dana.whitcombe@example.com");
    expect(card).toHaveTextContent("404-555-0148");
    expect(screen.getByRole("button", { name: "Looks right" })).toBeInTheDocument();
    expect(screen.getByText("Something to change? Email us at madison.sample@example.com.")).toBeInTheDocument();
    expect(details.container.querySelectorAll("main input")).toHaveLength(0);
    details.unmount();

    render(<MoveOverPeople />);
    expect(await screen.findByText("Morgan Whitcombe")).toBeInTheDocument();
    expect(screen.getByTestId("listed-adult")).toHaveTextContent("Bea, grandparent");
    expect(screen.getByTestId("listed-adult")).toHaveTextContent("Waiting");
    cleanup();

    render(<MoveOverClasses />);
    const classes = await screen.findAllByTestId("move-class");
    expect(classes.map((c) => within(c).getByText(/^(Juniper|Theo)$/).textContent)).toEqual(["Juniper", "Theo"]);
    expect(classes[1]).toHaveTextContent("Wednesdays at 5:00 pm, Madison");
    expect(within(classes[1]).getByTestId("prices")).toHaveTextContent(/^Bank draft\s*\$34\.00 a lesson\s*Card\s*\$35\.00 a lesson$/);
    expect(classes[1]).toHaveTextContent("No partner yet.");
    cleanup();

    const email = render(<MoveOverEmail />);
    expect(await screen.findByText("dana.whitcombe@example.com")).toBeInTheDocument();
    expect(email.container.querySelectorAll('main input[type="email"]')).toHaveLength(0);
  });
});

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { freshStore } from "./helpers";

vi.mock("next/navigation", async () => (await import("./helpers")).navigationMock());
vi.mock("next/link", async () => (await import("./helpers")).linkMock());

import { BillsScreen, MessagesScreen } from "@/components/screens/coming-next-screens";
import { ComingNext } from "@/components/shell/coming-next";
import { SampleBanner } from "@/components/shell/sample-banner";
import { ScreenShell } from "@/components/shell/screen-shell";
import { SAMPLE_BANNER } from "@/content/brand";
import { SCREENS } from "@/screens";

beforeEach(() => {
  freshStore();
});
afterEach(cleanup);

describe("shell", () => {
  it("sample banner shows the exact words", () => {
    render(<SampleBanner />);
    expect(screen.getByTestId("sample-banner")).toHaveTextContent(
      "Sample app. Made-up families, classes and prices. Please don't use real names, birthdays or health details. What you type stays on this phone.",
    );
    expect(SAMPLE_BANNER).toBe(
      "Sample app. Made-up families, classes and prices. Please don't use real names, birthdays or health details. What you type stays on this phone.",
    );
  });

  it("Sandbox pill opens the sheet with roles, fill, pretend, erase, staff link and every screen", async () => {
    render(
      <ScreenShell id="parent-home">
        <p>Body</p>
      </ScreenShell>,
    );
    const pill = screen.getByRole("button", { name: "Sandbox" });
    expect(pill.className).toContain("border-dashed");
    fireEvent.click(pill);
    const sheet = await screen.findByRole("dialog");
    const s = within(sheet);
    for (const role of ["New parent", "Family moving over", "Owner"]) expect(s.getAllByText(role).length).toBeGreaterThan(0);
    for (const role of ["New parent", "Family moving over", "Owner"]) expect(s.getByRole("button", { name: new RegExp(`^${role}`) })).toBeInTheDocument();
    expect(s.getByRole("button", { name: "Fill in a sample family" })).toBeInTheDocument();
    expect(s.getByRole("button", { name: "Pretend the first lesson happened" })).toBeInTheDocument();
    expect(s.getByRole("button", { name: "Erase all sample data on this phone" })).toBeInTheDocument();
    expect(s.getAllByRole("link", { name: /Staff side, coming later/ }).length).toBeGreaterThan(0);
    for (const sc of SCREENS) expect(s.getAllByRole("link", { name: new RegExp(sc.title.replace(/[()]/g, ".")) }).length).toBeGreaterThan(0);
    // Erase asks first.
    fireEvent.click(s.getByRole("button", { name: "Erase all sample data on this phone" }));
    expect(await screen.findByText("Erase all sample data on this phone?")).toBeInTheDocument();
  });

  it("tab bars for parents, the sign-up flow and the owner", () => {
    const { unmount } = render(
      <ScreenShell id="parent-home">
        <p>Body</p>
      </ScreenShell>,
    );
    const parentTabs = screen.getByRole("navigation", { name: "Family tabs" });
    expect(within(parentTabs).getAllByRole("link").map((a) => a.textContent)).toEqual(["Home", "First lesson", "Progress", "More"]);
    expect(within(parentTabs).getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    unmount();

    const flow = render(
      <ScreenShell id="sign-up-pool" backHref="/sign-up" step={{ n: 1, total: 9 }}>
        <p>Body</p>
      </ScreenShell>,
    );
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(screen.getByTestId("step-count")).toHaveTextContent("Step 1 of 9");
    flow.unmount();

    render(
      <ScreenShell id="owner-releases">
        <p>Body</p>
      </ScreenShell>,
    );
    const ownerTabs = screen.getByRole("navigation", { name: "Owner tabs" });
    expect(within(ownerTabs).getAllByRole("link").map((a) => a.textContent)).toEqual(["Release versions", "Staff side"]);
  });

  it("coming next component shows purpose, here you'll be able to lines, preview card and tag", () => {
    render(<ComingNext title="Bills" purpose="One purpose." lines={["a.", "b.", "c.", "d."]} preview={<p>Line</p>} />);
    expect(screen.getByText("Coming next")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bills" })).toBeInTheDocument();
    expect(screen.getAllByText(/^Here you'll be able to/)).toHaveLength(3);
    expect(within(screen.getByTestId("preview-card")).getByText("Preview")).toBeInTheDocument();
    cleanup();

    render(<MessagesScreen />);
    expect(
      screen.getByText("Tell us in a sentence, like \"We'll miss Sunday,\" and we'll take it from there. A person checks every reply."),
    ).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Family tabs" })).toBeInTheDocument();
    cleanup();

    render(<BillsScreen />);
    const preview = within(screen.getByTestId("preview-card"));
    expect(preview.getByText(/Bank draft \$136\.00/)).toBeInTheDocument();
    expect(preview.getByText(/Card \$140\.00/)).toBeInTheDocument();
  });
});

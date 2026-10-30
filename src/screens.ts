/*
  The one screens config. Every page in the app is a thin file that looks
  itself up here, so the Sandbox sheet, the tab bars and the screenshot
  tests all read the same list. Paths are static: no dynamic segments.
  Keep this file free of imports so Playwright can load it on its own.
*/

export type ScreenRole = "parent" | "moving" | "owner" | "staff";

/** filled: working content. coming-next: a finished placeholder for a later room. */
export type ScreenState = "filled" | "coming-next";

/** tabs: parent tab bar. flow: focused flow with a Back arrow and no tabs. owner: owner tab bar. */
export type ScreenShell = "tabs" | "flow" | "owner";

export type TabId = "home" | "first-lesson" | "progress" | "more" | "releases" | "staff";

export interface ScreenDef {
  id: string;
  path: string;
  role: ScreenRole;
  /** Page title (shown as "Title, Popsicle Pier sample app") and the name in the Sandbox list. */
  title: string;
  state: ScreenState;
  shell: ScreenShell;
  tab?: TabId;
}

export const SCREENS: readonly ScreenDef[] = [
  // New parent
  { id: "parent-home", path: "/", role: "parent", title: "Home", state: "filled", shell: "tabs", tab: "home" },
  { id: "sign-up-start", path: "/sign-up", role: "parent", title: "Sign up", state: "filled", shell: "flow" },
  { id: "sign-up-pool", path: "/sign-up/pool", role: "parent", title: "Pick a pool", state: "filled", shell: "flow" },
  { id: "sign-up-swimmers", path: "/sign-up/swimmers", role: "parent", title: "Your swimmers", state: "filled", shell: "flow" },
  { id: "sign-up-stage", path: "/sign-up/stage", role: "parent", title: "Where your swimmer is today", state: "filled", shell: "flow" },
  { id: "sign-up-times", path: "/sign-up/times", role: "parent", title: "Pick a time", state: "filled", shell: "flow" },
  { id: "sign-up-you", path: "/sign-up/you", role: "parent", title: "About you", state: "filled", shell: "flow" },
  { id: "sign-up-people", path: "/sign-up/people", role: "parent", title: "Your people", state: "filled", shell: "flow" },
  { id: "sign-up-who-stays", path: "/sign-up/who-stays", role: "parent", title: "Who stays", state: "filled", shell: "flow" },
  { id: "sign-up-payment", path: "/sign-up/payment", role: "parent", title: "How you'll pay", state: "filled", shell: "flow" },
  { id: "sign-up-release", path: "/sign-up/release", role: "parent", title: "Family release", state: "filled", shell: "flow" },
  { id: "youre-in", path: "/sign-up/youre-in", role: "parent", title: "You're in", state: "filled", shell: "flow" },
  { id: "first-lesson", path: "/first-lesson", role: "parent", title: "Your first lesson", state: "filled", shell: "tabs", tab: "first-lesson" },
  { id: "progress", path: "/progress", role: "parent", title: "Progress", state: "filled", shell: "tabs", tab: "progress" },
  { id: "more", path: "/more", role: "parent", title: "More", state: "filled", shell: "tabs", tab: "more" },
  { id: "lesson-dates", path: "/more/lessons", role: "parent", title: "Lesson dates", state: "filled", shell: "tabs", tab: "more" },
  { id: "bills", path: "/more/bills", role: "parent", title: "Bills", state: "coming-next", shell: "tabs", tab: "more" },
  { id: "messages", path: "/more/messages", role: "parent", title: "Messages", state: "coming-next", shell: "tabs", tab: "more" },

  // Family moving over
  { id: "move-over-welcome", path: "/move-over", role: "moving", title: "Welcome to the new app", state: "filled", shell: "flow" },
  { id: "move-over-details", path: "/move-over/details", role: "moving", title: "Your details", state: "filled", shell: "flow" },
  { id: "move-over-people", path: "/move-over/people", role: "moving", title: "Your people", state: "filled", shell: "flow" },
  { id: "move-over-classes", path: "/move-over/classes", role: "moving", title: "Your classes", state: "filled", shell: "flow" },
  { id: "move-over-email", path: "/move-over/email", role: "moving", title: "Confirm your email", state: "filled", shell: "flow" },
  { id: "move-over-payment", path: "/move-over/payment", role: "moving", title: "How you'll pay", state: "filled", shell: "flow" },
  { id: "move-over-release", path: "/move-over/release", role: "moving", title: "Family release", state: "filled", shell: "flow" },

  // Owner
  { id: "owner-releases", path: "/owner/releases", role: "owner", title: "Release versions", state: "filled", shell: "owner", tab: "releases" },

  // Every staff role
  { id: "staff", path: "/staff", role: "staff", title: "Staff side, coming later", state: "coming-next", shell: "owner", tab: "staff" },
];

export const ROLE_LABELS: Record<ScreenRole, string> = {
  parent: "New parent",
  moving: "Family moving over",
  owner: "Owner",
  staff: "Staff side",
};

export function screenById(id: string): ScreenDef {
  const found = SCREENS.find((s) => s.id === id);
  if (!found) throw new Error(`No screen with id ${id}`);
  return found;
}

/** Metadata for a page file. The layout's template adds ", Popsicle Pier sample app". */
export function screenMetadata(id: string): { title: string } {
  return { title: screenById(id).title };
}

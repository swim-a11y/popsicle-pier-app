/*
  The one-file preview (preview/build.mjs) runs without a server, inside a
  frame whose address it can't change, so it keeps the screen it's on in
  memory: "/sign-up/swimmers?child=2". This stands in for next/navigation
  there, with just what src/lib/nav.ts uses. A reload stays on the last
  screen; opening the file fresh with "#/sign-up" starts there.
*/
import { useMemo, useSyncExternalStore } from "react";

const KEY = "popsicle-pier-preview-screen";
const listeners = new Set<() => void>();

/** Where the preview starts: the last screen in this tab (a reload), or "#/path" on a fresh open, or Home. */
function startHref(): string {
  if (typeof window === "undefined") return "/";
  try {
    const saved = window.sessionStorage.getItem(KEY);
    if (saved?.startsWith("/")) return saved;
  } catch {
    // No session storage here.
  }
  const fromHash = window.location.hash.slice(1);
  return fromHash.startsWith("/") ? fromHash : "/";
}

let href = startHref();
const trail = [href];
if (typeof document !== "undefined") document.documentElement.dataset.previewScreen = href;

/** The screen the preview is on, like "/sign-up/swimmers?child=2". */
export function currentHref(): string {
  return href;
}

export function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Go to a screen, like router.push: the top of the page, remembered for a reload. */
export function navigate(next: string, replace = false) {
  href = next.startsWith("/") ? next : "/";
  if (replace) trail[trail.length - 1] = href;
  else trail.push(href);
  try {
    window.sessionStorage.setItem(KEY, href);
  } catch {
    // Not remembered: a reload starts at Home.
  }
  document.documentElement.dataset.previewScreen = href;
  for (const l of listeners) l();
  window.scrollTo(0, 0);
}

export function usePathname(): string {
  return useSyncExternalStore(subscribe, () => href.split("?")[0], () => "/");
}

export function useRouter() {
  return useMemo(
    () => ({
      push: (to: string) => navigate(to),
      replace: (to: string) => navigate(to, true),
      back: () => {
        if (trail.length < 2) return;
        trail.pop();
        navigate(trail.pop()!);
      },
      forward: () => {},
      refresh: () => {},
      prefetch: () => {},
    }),
    [],
  );
}

"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const NAV_EVENT = "popsicle-pier:navigate";

/**
 * Navigate and tell the current screen about the new query right away, so a
 * step that repeats per child (?child=2) updates without reading the URL
 * during render.
 */
export function useGo() {
  const router = useRouter();
  return useCallback(
    (href: string, options?: { replace?: boolean }) => {
      if (options?.replace) router.replace(href);
      else router.push(href);
      window.dispatchEvent(new CustomEvent(NAV_EVENT, { detail: href }));
    },
    [router],
  );
}

/** A query value, read only in effects and event handlers. undefined until mounted. */
export function useQueryValue(name: string): string | null | undefined {
  const pathname = usePathname();
  const [value, setValue] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const fromLocation = () => setValue(new URLSearchParams(window.location.search).get(name));
    const fromNavigation = (e: Event) => {
      const href = (e as CustomEvent<string>).detail;
      const url = new URL(href, window.location.origin);
      if (url.pathname === pathname) setValue(url.searchParams.get(name));
    };
    fromLocation();
    window.addEventListener("popstate", fromLocation);
    window.addEventListener(NAV_EVENT, fromNavigation);
    return () => {
      window.removeEventListener("popstate", fromLocation);
      window.removeEventListener(NAV_EVENT, fromNavigation);
    };
  }, [name, pathname]);
  return value;
}

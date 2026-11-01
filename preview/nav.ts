/*
  src/lib/nav.ts for the one-file preview: the same hooks, reading the
  query from the screen the preview holds in memory instead of the address.
*/
import { useCallback, useEffect, useState } from "react";

import { currentHref, subscribe, usePathname, useRouter } from "./next-navigation";

const NAV_EVENT = "popsicle-pier:navigate";

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

export function useQueryValue(name: string): string | null | undefined {
  const pathname = usePathname();
  const [value, setValue] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const read = (href: string) => {
      const [path, query = ""] = href.split("?");
      return { path, value: new URLSearchParams(query).get(name) };
    };
    const fromLocation = () => setValue(read(currentHref()).value);
    const fromNavigation = (e: Event) => {
      const next = read((e as CustomEvent<string>).detail);
      if (next.path === pathname) setValue(next.value);
    };
    fromLocation();
    const stop = subscribe(fromLocation);
    window.addEventListener(NAV_EVENT, fromNavigation);
    return () => {
      stop();
      window.removeEventListener(NAV_EVENT, fromNavigation);
    };
  }, [name, pathname]);
  return value;
}

/* Stands in for next/link in the one-file preview: an ordinary link to "#/path" that moves without reloading. */
import { forwardRef, type AnchorHTMLAttributes } from "react";

import { navigate } from "./next-navigation";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string; prefetch?: boolean; replace?: boolean; scroll?: boolean };

const Link = forwardRef<HTMLAnchorElement, Props>(function Link({ href, prefetch, replace, scroll, onClick, ...rest }, ref) {
  void prefetch;
  void scroll;
  return (
    <a
      ref={ref}
      href={`#${href}`}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(href, replace);
      }}
      {...rest}
    />
  );
});

export default Link;

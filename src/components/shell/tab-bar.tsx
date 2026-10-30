import Link from "next/link";
import { FileTextIcon, HouseIcon, MapPinIcon, NotebookTextIcon, EllipsisIcon, UsersIcon } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import type { TabId } from "@/screens";
import { cn } from "@/lib/utils";

interface Tab {
  id: TabId;
  label: string;
  href: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export const PARENT_TABS: readonly Tab[] = [
  { id: "home", label: "Home", href: "/", Icon: HouseIcon },
  { id: "first-lesson", label: "First lesson", href: "/first-lesson", Icon: MapPinIcon },
  { id: "progress", label: "Progress", href: "/progress", Icon: NotebookTextIcon },
  { id: "more", label: "More", href: "/more", Icon: EllipsisIcon },
];

export const OWNER_TABS: readonly Tab[] = [
  { id: "releases", label: "Release versions", href: "/owner/releases", Icon: FileTextIcon },
  { id: "staff", label: "Staff side", href: "/staff", Icon: UsersIcon },
];

export function TabBar({ tabs, current, label }: { tabs: readonly Tab[]; current?: TabId; label: string }) {
  return (
    <nav aria-label={label} className="fixed inset-x-0 bottom-0 z-30 bg-surface shadow-bar">
      <ul className="mx-auto flex h-tab-bar max-w-page">
        {tabs.map(({ id, label: text, href, Icon }) => {
          const active = id === current;
          return (
            <li key={id} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 border-t-4 text-small no-underline",
                  active ? "border-mark font-strong text-heading" : "border-transparent text-foreground",
                )}
              >
                <Icon className="size-6" aria-hidden />
                <span>{text}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

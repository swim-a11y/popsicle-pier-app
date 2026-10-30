import type { ReactNode } from "react";

import { Tag } from "@/components/parts/tag";
import { PageTitle } from "@/components/shell/screen-shell";
import { Card } from "@/components/ui/card";

/** A finished placeholder for a room that comes later: purpose, up to three lines, one Preview card. */
export function ComingNext({
  title,
  purpose,
  lines,
  preview,
  children,
}: {
  title: string;
  purpose: string;
  lines: string[];
  preview: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5" aria-labelledby="coming-next-title">
      <div className="flex flex-col gap-3">
        <Tag tone="highlight">Coming next</Tag>
        <PageTitle>
          <span id="coming-next-title">{title}</span>
        </PageTitle>
        <p>{purpose}</p>
      </div>
      <ul className="flex list-disc flex-col gap-2 pl-5">
        {lines.slice(0, 3).map((line) => (
          <li key={line}>Here you&apos;ll be able to {line}</li>
        ))}
      </ul>
      {children}
      <Card className="gap-2 border-2 border-dashed border-line shadow-none" data-testid="preview-card">
        <p className="font-strong text-heading">Preview</p>
        {preview}
      </Card>
    </section>
  );
}

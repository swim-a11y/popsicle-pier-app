"use client";

import { SkeletonRows } from "@/components/parts/skeleton";
import { Tag } from "@/components/parts/tag";
import { PageTitle, ScreenShell } from "@/components/shell/screen-shell";
import { useAppData } from "@/data/use-data";
import { monthDayYear } from "@/rules/dates";

/** The owner's read-only view of each published release version. */
export function OwnerReleasesScreen() {
  const loaded = useAppData();
  if (!loaded) {
    return (
      <ScreenShell id="owner-releases">
        <SkeletonRows rows={2} />
      </ScreenShell>
    );
  }
  const { data } = loaded;
  const versions = [...data.releaseVersions].sort((a, b) => b.number - a.number);
  return (
    <ScreenShell id="owner-releases">
      <PageTitle>Release versions</PageTitle>
      <p>Read-only. Published text never changes; a change is a new version, and families on an older one sign the current version once.</p>
      {versions.map((v) => {
        const families = new Set(data.releaseSignatures.filter((s) => s.versionId === v.id).map((s) => s.familyId));
        return (
          <article key={v.id} className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card" aria-labelledby={`version-${v.id}`} data-testid="release-version">
            <div className="flex items-center justify-between gap-2">
              <h2 id={`version-${v.id}`} className="font-heading text-big text-heading">
                Version {v.number}
              </h2>
              {v.isCurrent ? <Tag tone="mark">Current</Tag> : <Tag>Older</Tag>}
            </div>
            <p data-testid="version-date">Published {monthDayYear(v.publishedOn)}</p>
            <div className="flex flex-col gap-1">
              <h3 className="font-strong text-heading">What changed</h3>
              <ul className="flex list-disc flex-col gap-1 pl-5">
                {v.whatChanged.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="font-strong text-heading">Fingerprint (SHA-256 of the text)</h3>
              <p className="break-all" data-testid="version-fingerprint">
                {v.fingerprint}
              </p>
            </div>
            <p className="font-strong" data-testid="version-count">
              Signed by {families.size} sample {families.size === 1 ? "family" : "families"}
            </p>
          </article>
        );
      })}
    </ScreenShell>
  );
}

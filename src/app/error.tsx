"use client";

import { SHORT_NAME } from "@/content/brand";

/** Inside the root layout, so the sample banner stays on top. */
export default function ErrorScreen({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex max-w-page flex-col gap-4 px-gutter py-8">
      <p className="font-heading text-body text-heading">{SHORT_NAME}</p>
      <h1 className="font-heading text-big text-heading">That didn&apos;t load</h1>
      <p>Anything you typed on this phone is still here. Try again.</p>
      <button type="button" onClick={reset} className="min-h-tap-big rounded-control bg-primary px-6 font-strong text-primary-foreground">
        Try again
      </button>
    </main>
  );
}

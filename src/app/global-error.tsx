"use client";

import "@fontsource/questrial/400.css";
import "@fontsource/work-sans/400.css";
import "@fontsource/work-sans/600.css";
import "./globals.css";

import { SampleBanner } from "@/components/shell/sample-banner";
import { SHORT_NAME } from "@/content/brand";

/** Replaces the root layout when it fails, so it brings its own sample banner. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <head>
        <title>Popsicle Pier sample app</title>
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body>
        <SampleBanner />
        <main className="mx-auto flex max-w-page flex-col gap-4 px-gutter py-8">
          <p className="font-heading text-body text-heading">{SHORT_NAME}</p>
          <h1 className="font-heading text-big text-heading">That didn&apos;t load</h1>
          <p>Anything you typed on this phone is still here. Try again.</p>
          <button type="button" onClick={reset} className="min-h-tap-big rounded-control bg-primary px-6 font-strong text-primary-foreground">
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}

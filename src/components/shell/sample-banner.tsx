import { SAMPLE_BANNER } from "@/content/brand";

/** Fixed at the top of every screen, every role. */
export function SampleBanner() {
  return (
    <header className="sticky top-0 z-40 bg-top-bar text-on-top-bar">
      <p data-testid="sample-banner" className="mx-auto max-w-page px-gutter py-2 text-small">
        {SAMPLE_BANNER}
      </p>
    </header>
  );
}

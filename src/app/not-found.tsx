import Link from "next/link";

import { SHORT_NAME } from "@/content/brand";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-page flex-col gap-4 px-gutter py-8">
      <p className="font-heading text-body text-heading">{SHORT_NAME}</p>
      <h1 className="font-heading text-big text-heading">This page isn&apos;t here</h1>
      <p>Head back to the start of the sample.</p>
      <Link href="/" className="font-strong">
        Go to Home
      </Link>
    </main>
  );
}

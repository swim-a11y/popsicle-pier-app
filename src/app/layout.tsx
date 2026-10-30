import type { Metadata, Viewport } from "next";
import "@fontsource/questrial/400.css";
import "@fontsource/work-sans/400.css";
import "@fontsource/work-sans/600.css";
import "./globals.css";

import { SampleBanner } from "@/components/shell/sample-banner";

export const metadata: Metadata = {
  title: { default: "Popsicle Pier sample app", template: "%s, Popsicle Pier sample app" },
  description: "Popsicle Pier sample app. Made-up families, classes and prices.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  formatDetection: { telephone: false, email: false, address: false, date: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <SampleBanner />
        {children}
      </body>
    </html>
  );
}

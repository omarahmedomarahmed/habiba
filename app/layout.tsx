import type { Metadata, Viewport } from "next";

import { env } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl),
  title: {
    default: "24Therapy — your session notes, written for you",
    template: "%s · 24Therapy",
  },
  description:
    "Record a therapy session on your phone and walk away with a SOAP note, clinical insights and a report you can send to your patient.",
  openGraph: {
    type: "website",
    siteName: "24Therapy",
    url: env.appUrl,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#0A2342",
  width: "device-width",
  initialScale: 1,
  // Deliberately not disabling user zoom: pinch-to-zoom is an accessibility
  // affordance, and a clinical app is exactly where someone needs it.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

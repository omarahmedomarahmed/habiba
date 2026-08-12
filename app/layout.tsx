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

/**
 * Language and direction are set here, once, from the request.
 *
 * `dir` on `<html>` is what makes right-to-left actually work: the browser
 * mirrors the whole box model, and every CSS logical property in the app —
 * `ms-*`, `me-*`, `ps-*`, `pe-*`, `text-start` — follows from it. Setting the
 * text to Arabic without setting this produces Arabic laid out left to right,
 * which is the most recognisable way an interface announces that nobody
 * localised it.
 *
 * It is deliberately not a client-side toggle. A layout that flips after
 * hydration shows every patient a frame of the wrong direction, and on a slow
 * phone in a crisis that frame is a long one.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { getLocale } = await import("@/lib/i18n/server");
  const { dirFor } = await import("@/lib/i18n/config");
  const { I18nProvider } = await import("@/lib/i18n/client");

  const locale = await getLocale();

  return (
    <html lang={locale} dir={dirFor(locale)}>
      <body>
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}

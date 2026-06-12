import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const inter = localFont({
  src: "../../../packages/fonts/inter-var.woff2",
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "24Therapy — Therapist Portal",
    template: "%s | 24Therapy",
  },
  description: "AI-powered mental health operating system for therapists. Reduce documentation burden, gain clinical insights, and deliver better care.",
  robots: { index: false, follow: false }, // Portal is not indexed
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}

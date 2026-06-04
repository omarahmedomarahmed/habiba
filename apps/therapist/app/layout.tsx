import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
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

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "24Therapy.ai — AI-Powered Mental Health Platform",
    template: "%s | 24Therapy.ai",
  },
  description:
    "AI-Native Mental Health Operating System. Real-time AI documentation, clinical copilot, instant therapist matching, and comprehensive practice management.",
  keywords: [
    "mental health platform",
    "AI therapy",
    "telehealth",
    "AI scribe",
    "clinical documentation",
    "therapist tools",
    "mental health OS",
  ],
  authors: [{ name: "24Therapy.ai" }],
  creator: "24Therapy.ai",
  publisher: "24Therapy.ai",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://24therapy.ai",
    siteName: "24Therapy.ai",
    title: "24Therapy.ai — AI-Powered Mental Health Platform",
    description:
      "The Operating System for Mental Healthcare. AI Scribe, Copilot, Instant Matching.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "24Therapy.ai",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "24Therapy.ai",
    description: "AI-Native Mental Health Operating System",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#0A2342",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}

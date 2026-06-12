import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const inter = localFont({ src: "../../../packages/fonts/inter-var.woff2", variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "24Therapy — Patient Portal",
  description: "Your mental health journey, supported every step of the way.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}

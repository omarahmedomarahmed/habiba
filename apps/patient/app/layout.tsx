import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "24Therapy — Patient Portal",
  description: "Your mental health journey, supported every step of the way.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const inter = localFont({ src: '../../../packages/fonts/inter-var.woff2', variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: '24Therapy Admin — Platform Operations',
  description: 'Super admin dashboard for 24Therapy Mental Health OS',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased font-sans">{children}</body>
    </html>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit

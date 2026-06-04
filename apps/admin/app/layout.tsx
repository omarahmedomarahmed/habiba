import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '24Therapy Admin — Platform Operations',
  description: 'Super admin dashboard for 24Therapy Mental Health OS',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

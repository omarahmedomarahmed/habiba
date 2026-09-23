import type { Metadata } from "next";
import type { ReactNode } from "react";

import { MotionRoot } from "./_ds/motion";

/**
 * The redesign, live and interactive (takeover/design/RESEARCH.md). Outside the
 * public site's chrome so each sample owns the whole screen. `noindex`: a design
 * reference competing with the real pages in search would be self-inflicted.
 */
export const metadata: Metadata = {
  title: { default: "24Therapy design", template: "%s · 24Therapy design" },
  robots: { index: false, follow: false },
};

export default function DesignLayout({ children }: { children: ReactNode }) {
  return (
    <MotionRoot>
      <div dir="ltr" lang="en" className="min-h-screen bg-navy-50 text-navy-600 antialiased">
        {children}
      </div>
    </MotionRoot>
  );
}

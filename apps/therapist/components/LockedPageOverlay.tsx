'use client';

import { Lock } from 'lucide-react';
import Link from 'next/link';

interface Props {
  isLocked: boolean;
  children: React.ReactNode;
}

export function LockedPageOverlay({ isLocked, children }: Props) {
  if (!isLocked) return <>{children}</>;
  return (
    <div className="relative min-h-[60vh]">
      {/* Blurred background showing page shape */}
      <div className="opacity-10 pointer-events-none select-none blur-sm" aria-hidden>
        {children}
      </div>
      {/* Lock overlay */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center border border-slate-100">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-blue-500" />
          </div>
          <h3 className="text-slate-900 text-xl font-bold mb-2">Complete your profile</h3>
          <p className="text-slate-500 text-sm mb-2">
            Your account is pending approval. Complete your profile and we&apos;ll review it within 24 hours.
          </p>
          <p className="text-blue-600 text-sm font-medium mb-6">
            🎉 Your first session is free once approved.
          </p>
          <Link
            href="/settings"
            className="block w-full py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors"
          >
            Complete Your Profile
          </Link>
          <Link href="/onboarding" className="block mt-2 text-xs text-slate-400 hover:text-slate-600">
            View onboarding checklist →
          </Link>
        </div>
      </div>
    </div>
  );
}

// Session 24 — unverified UX lock overlay

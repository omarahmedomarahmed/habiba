"use client";

import { Clock, Shield } from "lucide-react";

export function PendingApprovalBanner() {
  return (
    <div className="w-full bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center gap-3">
      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-semibold text-amber-800">Account under review </span>
        <span className="text-sm text-amber-700">— Admin approval is required before you can start sessions. Complete your profile while you wait.</span>
      </div>
      <Shield className="w-4 h-4 text-amber-500 shrink-0" />
    </div>
  );
}

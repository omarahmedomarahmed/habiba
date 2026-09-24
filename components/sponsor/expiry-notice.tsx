/**
 * 🔴 W2-S08: THE POT'S DATE, ON THE COMPANY'S OWN SCREEN, WHEN IT MATTERS.
 *
 * `payFromPot` stops paying on the expiry date. Thirty days before, the pot page
 * and the overview say so in amber (the admins are also emailed by `alertPots`);
 * after it, they say the pot no longer pays. Outside that window nothing is
 * shown here and the date stays the quiet line under the meter.
 */
export const EXPIRY_NOTICE_DAYS = 30;

export function expiryState(expiresAt: Date | null, now = new Date()): "soon" | "expired" | null {
  if (!expiresAt) return null;
  const left = expiresAt.getTime() - now.getTime();
  if (left <= 0) return "expired";
  return left <= EXPIRY_NOTICE_DAYS * 24 * 60 * 60 * 1000 ? "soon" : null;
}

export function ExpiryNotice({ text }: { text: string }) {
  return (
    <p
      role="status"
      className="rounded-xl bg-amber-50 p-3 text-sm font-medium leading-relaxed text-amber-900"
    >
      {text}
    </p>
  );
}

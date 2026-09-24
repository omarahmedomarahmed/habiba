/**
 * 🔴 W2-P05: the one address a PATIENT is sent for their own session.
 *
 * Booking confirmations and reminders linked to `/sessions/{id}`, the
 * clinician's session page, which middleware bounces to the clinician's
 * sign-in. A patient opening "Open your session" met a therapist's login.
 *
 * The patient's own door is the join link: it works signed in or out, shows
 * the pay step when money is owed, and opens the room when it is time. No
 * token, no link: an email with a dead link is worse than one with none.
 */
export function patientSessionUrl(appUrl: string, joinToken: string | null | undefined): string | null {
  return joinToken ? `${appUrl}/join/${joinToken}` : null;
}

/** The same, shaped as a `notify` link. */
export function patientSessionLink(
  appUrl: string,
  joinToken: string | null | undefined,
): { label: string; url: string } | null {
  const url = patientSessionUrl(appUrl, joinToken);
  return url ? { label: "Open your session", url } : null;
}

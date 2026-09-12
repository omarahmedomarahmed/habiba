import type { MeetingProvider } from "@/lib/db/schema";

/**
 * The three meeting providers, and what is true about each today.
 * PLAN.md 41.2, 41.3, and the rule `lib/integrations/registry.ts` sets.
 *
 * ## 🔴 Why a clinician is told BEFORE they try
 *
 * 41.3: *many clinics block third-party Zoom apps.* A Connect button that
 * fails after an OAuth round trip, on an IT policy nobody here can change, is
 * a clinician who now believes the product is broken. The warning is on the
 * page in advance, per provider, because the reason differs: Zoom is blocked
 * by clinic policy, Google Workspace by admin consent, Teams by tenant
 * policy.
 *
 * ## The scopes, which are the enforcement of C132
 *
 * Meeting creation only. No calendar scope is listed here, so none is
 * requested, so none can be granted. A tool that watches a calendar eventually
 * records a supervision call or a conversation with an accountant, and the
 * person whose words those are never agreed to anything.
 *
 * That is a stronger guarantee than a rule in a service: an access token
 * without a calendar scope cannot read a calendar even if a future call site
 * asks it to.
 */

export type ProviderSpec = {
  provider: MeetingProvider;
  /** The name a clinician calls it. */
  name: string;
  /**
   * 🔴 Meeting creation only. Adding a calendar scope here is the one edit
   * to this file that changes what the product is allowed to do, which is why
   * `verify:sprint41` asserts against this list by name.
   */
  scopes: string[];
  authorizeUrl: string;
  tokenUrl: string;
  /** Why a connection attempt might fail for reasons nobody here controls. */
  mayBeBlocked: string;
};

export const PROVIDERS: Record<MeetingProvider, ProviderSpec> = {
  zoom: {
    provider: "zoom",
    name: "Zoom",
    scopes: ["meeting:write:meeting"],
    authorizeUrl: "https://zoom.us/oauth/authorize",
    tokenUrl: "https://zoom.us/oauth/token",
    mayBeBlocked:
      "Many clinics and hospitals block third-party Zoom apps at the account level. If your organisation does, this will not connect and there is nothing we can change from here.",
  },
  google_meet: {
    provider: "google_meet",
    name: "Google Meet",
    scopes: ["https://www.googleapis.com/auth/meetings.space.created"],
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    mayBeBlocked:
      "Google Workspace administrators can require approval before an app is allowed. If yours does, connecting will stop at a screen asking you to contact them.",
  },
  teams: {
    provider: "teams",
    name: "Microsoft Teams",
    scopes: ["OnlineMeetings.ReadWrite"],
    authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    mayBeBlocked:
      "Microsoft tenants often require an administrator to consent on behalf of everybody. If yours does, you will be told to ask them rather than being able to approve it yourself.",
  },
};

/**
 * 🔴 The scope guard, as a function rather than a comment.
 *
 * Anything that reads a calendar, a recording archive or a user's meeting
 * history is refused here. The point is not that today's three entries are
 * correct — they are, and they are checked — but that adding a fourth, or
 * widening one, has to get past this.
 */
const FORBIDDEN_SCOPE = /calendar|recording|history|report|user:read|contacts|drive|mail/i;

export function scopesAreMeetingOnly(spec: ProviderSpec): boolean {
  return spec.scopes.every((scope) => !FORBIDDEN_SCOPE.test(scope));
}

export function providerSpec(provider: string): ProviderSpec | null {
  return (PROVIDERS as Record<string, ProviderSpec>)[provider] ?? null;
}

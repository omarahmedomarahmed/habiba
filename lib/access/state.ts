/**
 * What a therapist may see about a patient, as arithmetic. PLAN.md 7.7.
 *
 * §3 defines four states. This module is the only place they are decided, and
 * it is pure — no database, no `Actor` — so every rule below is a test rather
 * than a paragraph somebody has to remember while editing a query.
 *
 * | State | What the therapist gets |
 * |---|---|
 * | **No relationship** | This session's transcript only |
 * | **Unclaimed, documented** | Full copilot over what they uploaded, on the unclaimed allowance |
 * | **Claimed, access granted** | Full copilot — live profile, files, diagnosis, sessions |
 * | **Claimed, access revoked** | Degraded: own transcripts, own notes, own uploads, the old chat. No live profile, no files, no diagnosis changes |
 *
 * ## Revoking cannot un-read
 *
 * §3 is explicit and so is `capabilities.oldChat`: a revoked therapist keeps
 * the conversation they already had. Deleting it would be pretending the
 * reading never happened, and the therapist's own clinical record is not the
 * patient's to erase. What revocation stops is *new* reading.
 */

export const ACCESS_STATES = [
  "no_relationship",
  "unclaimed_bare",
  "unclaimed_documented",
  "granted",
  "revoked",
] as const;
export type AccessState = (typeof ACCESS_STATES)[number];

export type Capabilities = {
  /** The person's own profile as it stands now, across every clinic. */
  liveProfile: boolean;
  /** Documents the patient uploaded themselves. */
  patientFiles: boolean;
  /** May write a diagnosis onto the shared record. */
  diagnosisChanges: boolean;
  /** Transcripts of sessions this therapist ran. Never taken away. */
  ownTranscripts: boolean;
  /** Notes this therapist wrote. Never taken away. */
  ownNotes: boolean;
  /** The copilot conversation they already had. Never taken away — see above. */
  oldChat: boolean;
  /** Ask the copilot new questions at all. */
  copilot: boolean;
  /** Whether a "request access" button should be offered. */
  canRequestAccess: boolean;
};

export type GrantView = {
  status: "pending" | "granted" | "rejected" | "revoked";
  /** Null on an open-ended grant. */
  expiresAt: Date | null;
};

/**
 * A grant is live only if it says granted **and** has not run out.
 *
 * Expiry is compared here rather than flipped by a job: a cron that runs late
 * is a therapist reading a chart after consent ended. `now` is a parameter so
 * the boundary is testable at the exact second.
 */
export function isLiveGrant(grant: GrantView | null, now: Date): boolean {
  if (!grant || grant.status !== "granted") return false;
  if (grant.expiresAt === null) return true;
  return grant.expiresAt.getTime() > now.getTime();
}

export type AccessInput = {
  /** Does this therapist hold a patient row for them at all? */
  hasPatientRow: boolean;
  /** Has the person taken ownership of their record? */
  claimed: boolean;
  /**
   * §3's unlock: a diagnosis **and** a written or dictated history.
   *
   * See C46 — there is nowhere to store a history yet, so today's callers pass
   * whether a diagnosis exists. The state is reported truthfully so a screen
   * can say what is missing; what it does not do is take the copilot away.
   */
  documented: boolean;
  grant: GrantView | null;
  now: Date;
};

export function accessStateFor(input: AccessInput): AccessState {
  if (!input.hasPatientRow) return "no_relationship";

  if (!input.claimed) {
    // Unclaimed is the therapist's own file. Nobody has granted anything
    // because there is nobody to ask — and nothing here is shareable (§6).
    return input.documented ? "unclaimed_documented" : "unclaimed_bare";
  }

  return isLiveGrant(input.grant, input.now) ? "granted" : "revoked";
}

export function capabilitiesFor(state: AccessState): Capabilities {
  switch (state) {
    case "granted":
      return {
        liveProfile: true,
        patientFiles: true,
        diagnosisChanges: true,
        ownTranscripts: true,
        ownNotes: true,
        oldChat: true,
        copilot: true,
        canRequestAccess: false,
      };

    case "revoked":
      /*
       * The degraded state, and the one worth reading carefully.
       *
       * Everything the therapist produced stays. Everything that belongs to
       * the person now — their live profile, their uploads, the diagnosis on
       * their shared record — stops. The copilot still answers, over the
       * therapist's own material only, which is why `copilot` is true here and
       * `liveProfile` is not.
       */
      return {
        liveProfile: false,
        patientFiles: false,
        diagnosisChanges: false,
        ownTranscripts: true,
        ownNotes: true,
        oldChat: true,
        copilot: true,
        canRequestAccess: true,
      };

    case "unclaimed_documented":
    case "unclaimed_bare":
      /*
       * An unclaimed record is a private file. The therapist has full use of
       * what they wrote — and there is no live profile to read, no patient
       * uploads, and nobody who could grant access if they asked.
       */
      return {
        liveProfile: false,
        patientFiles: false,
        diagnosisChanges: true,
        ownTranscripts: true,
        ownNotes: true,
        oldChat: true,
        copilot: true,
        canRequestAccess: false,
      };

    case "no_relationship":
      // §3: this session's transcript only. Nothing historical, nothing to ask
      // about, and no button — a stranger requesting access to a person who
      // never saw them is a channel for harassment, not a feature.
      return {
        liveProfile: false,
        patientFiles: false,
        diagnosisChanges: false,
        ownTranscripts: false,
        ownNotes: false,
        oldChat: false,
        copilot: false,
        canRequestAccess: false,
      };
  }
}

/** What the therapist is told, in the banner. Never alarming about the patient. */
export function explain(state: AccessState): string | null {
  switch (state) {
    case "revoked":
      return "This person has not granted you access to their profile. You can still see your own sessions, your own notes and your earlier copilot conversation — but not their live profile, their files, or their current diagnosis.";
    case "unclaimed_bare":
      return "This record is yours alone until the person it describes claims it. Add a diagnosis and a history to get the most out of the copilot.";
    case "no_relationship":
      return "You have no record for this person, so the copilot only has this session's transcript.";
    case "unclaimed_documented":
    case "granted":
      return null;
  }
}

/**
 * §3's preset reasons for declining. PLAN.md 7.4.
 *
 * Here, in the pure module, rather than beside the query that stores them:
 * the patient's screen is a client component and importing them from
 * `lib/data/grants` dragged `server-only` into the browser bundle.
 *
 * Presets and no free text. A person declining their own therapist should not
 * have to compose a message, and free text would put whatever they typed in
 * distress in front of the clinician they are refusing.
 */
export const REJECTION_REASONS = [
  "I would rather keep my history private",
  "I do not remember seeing this therapist",
  "I am no longer seeing them",
] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

export function isRejectionReason(value: unknown): value is RejectionReason {
  return typeof value === "string" && (REJECTION_REASONS as readonly string[]).includes(value);
}

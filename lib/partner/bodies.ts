/**
 * DD-2: the request bodies of POST /api/partner/v1/sessions and
 * POST /api/partner/v1/consent, read in one place.
 *
 * The routes call these, and so does `tests/partner-docs.test.ts` against the
 * examples the public docs print (`PARTNER_DOC_EXAMPLES`), so a documented
 * body that would get a 400 fails CI. No database, no key.
 */

export type BodyResult<T> = { ok: true; value: T } | { ok: false; error: string };

export type SessionBody = {
  subject: string;
  clinician: string;
  startedAt: Date;
  durationMinutes: number;
  meetingId: string;
};

export function readSessionBody(body: Record<string, unknown>): BodyResult<SessionBody> {
  const { subject, clinician, started_at: startedAt, duration_minutes: minutes, meeting_id: meetingId } = body;
  if (
    typeof subject !== "string" ||
    typeof clinician !== "string" ||
    typeof startedAt !== "string" ||
    typeof minutes !== "number" ||
    typeof meetingId !== "string"
  ) {
    return { ok: false, error: "Send subject, clinician, started_at, duration_minutes and meeting_id." };
  }
  return {
    ok: true,
    value: { subject, clinician, startedAt: new Date(startedAt), durationMinutes: minutes, meetingId },
  };
}

export type ConsentBody = {
  session: string;
  subject: string;
  state: "given" | "withdrawn";
  answeredAt: Date;
  offsetSeconds: number;
};

export function readConsentBody(body: Record<string, unknown>): BodyResult<ConsentBody> {
  const { session, subject, state, answered_at: answeredAt } = body;
  const offset = body.offset_seconds ?? 0;

  if (typeof session !== "string" || typeof subject !== "string") {
    return { ok: false, error: "Send session and subject." };
  }
  /*
   * TWO STATES, AND "PENDING" IS NOT ONE OF THEM. The absence of a row is
   * pending; accepting a third value would let an integration write "pending"
   * over a "given" and lose a consent somebody gave.
   */
  if (state !== "given" && state !== "withdrawn") {
    return { ok: false, error: 'state must be "given" or "withdrawn".' };
  }
  if (typeof answeredAt !== "string") return { ok: false, error: "Send answered_at as an ISO time." };
  if (typeof offset !== "number" || !Number.isFinite(offset)) {
    return { ok: false, error: "offset_seconds must be a number of seconds from the session's start." };
  }
  const answered = new Date(answeredAt);
  if (Number.isNaN(answered.getTime())) return { ok: false, error: "answered_at is not a time." };

  return { ok: true, value: { session, subject, state, answeredAt: answered, offsetSeconds: offset } };
}

/**
 * The example bodies the public pages print (/developers and /integrations).
 * Rendered from here, so the page and the test read the same JSON.
 */
export const PARTNER_DOC_EXAMPLES = {
  session: {
    subject: "P-77",
    clinician: "dr@example.com",
    started_at: "2026-09-12T14:00:00Z",
    duration_minutes: 50,
    meeting_id: "M-8814",
  },
  consent: {
    session: "S-1024",
    subject: "P-77",
    state: "given",
    answered_at: "2026-09-14T10:40:00Z",
    offset_seconds: 600,
  },
} as const;

/** One example body as the docs print it: compact JSON, one field per line. */
export function exampleJson(body: Record<string, unknown>): string {
  const lines = Object.entries(body).map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`);
  return `{\n${lines.join(",\n")}\n}`;
}

"use server";

import { fullName } from "@/lib/utils";

export type FeedbackState = { error?: string; ok?: boolean; sent?: boolean };

/**
 * A patient rating a session, and getting their summary for it.
 *
 * Unauthenticated by design — the person filling this in has no account and is
 * never going to make one. The join token they already hold is the credential,
 * and it identifies exactly one session that has already happened.
 */
export async function rateSession(input: {
  token: string;
  therapistStars: number;
  serviceStars: number;
  therapistTags: string[];
  serviceTags: string[];
  comment: string;
  email: string;
}): Promise<FeedbackState> {
  const { callerKey, consume } = await import("@/lib/rate-limit");
  const attempt = await consume(await callerKey("feedback"), 20, 600);
  if (!attempt.allowed) return { error: "Too many submissions from this connection." };

  const { submitFeedback, feedbackContext, markBriefSent } = await import("@/lib/data/feedback");

  const saved = await submitFeedback(input);
  if (saved.error) return { error: saved.error };

  const context = await feedbackContext(input.token);
  if (!context) return { ok: true };

  /*
   * Send the brief now if the clinician has already signed the note.
   *
   * If they have not, this returns success anyway and the note-approval path
   * sends it — the patient has done their part and must not be left staring at
   * a form waiting for somebody else's paperwork.
   */
  if (context.brief) {
    const { sendSessionReport } = await import("@/lib/mail");
    const sent = await sendSessionReport({
      to: input.email.trim().toLowerCase(),
      patientName: "there",
      therapistName: context.therapistName || "Your therapist",
      note: {
        soap: { subjective: "", objective: "", assessment: "", plan: "" },
        summary: "",
        patientBrief: context.brief,
        talkingPoints: [],
        observations: "",
        impressions: "",
        recommendations: [],
        followUp: "",
      },
      language: context.briefLanguage,
      sessionDate: context.sessionDate,
    });
    if (sent) await markBriefSent(context.sessionId);
    return { ok: true, sent };
  }

  return { ok: true, sent: false };
}

/**
 * Something went wrong, and it is not a star rating.
 *
 * A no-show refunds the patient and suspends the clinician from the radar
 * without waiting for anyone to read it, because the patient paid for a
 * session that did not happen and making them wait for office hours to get
 * their money back is the wrong answer to our own failure. Everything else
 * goes to a human.
 */
export async function reportSession(input: {
  token: string;
  kind: "no_show" | "abuse" | "other";
  detail: string;
  email: string;
}): Promise<FeedbackState> {
  const { callerKey, consume } = await import("@/lib/rate-limit");
  const attempt = await consume(await callerKey("report"), 10, 600);
  if (!attempt.allowed) return { error: "Too many reports from this connection." };

  const { fileReport, countNoShows, suspensionFor, suspendFromRadar } = await import(
    "@/lib/data/feedback"
  );

  const filed = await fileReport(input);
  if (filed.error) return { error: filed.error };

  if (input.kind === "no_show" && filed.sessionId && filed.therapistId) {
    const { refundSessionPayment } = await import("@/lib/billing/connect");
    const { db } = await import("@/lib/db");
    const { sessionPayments, sessionReports, users } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    // Refund first. If the suspension fails we would rather have given the
    // money back and left a clinician on the board than the other way round.
    const [payment] = await db
      .select({ id: sessionPayments.id })
      .from(sessionPayments)
      .where(eq(sessionPayments.sessionId, filed.sessionId))
      .limit(1);

    if (payment) {
      try {
        await refundSessionPayment({
          paymentId: payment.id,
          reason: "Therapist did not attend a booked session",
          // The refund is automatic, so there is no administrator to name. The
          // report row carries who and why; this field wants a user id and the
          // therapist is the party it concerns.
          adminUserId: filed.therapistId,
        });
      } catch {
        /* Already refunded, or payments are not configured here. */
      }
    }

    const prior = await countNoShows(filed.therapistId);
    const penalty = suspensionFor(prior);
    await suspendFromRadar(filed.therapistId, penalty.hours, "Reported for not attending a booking");

    await db
      .update(sessionReports)
      .set({
        status: "actioned",
        resolution: `Automatic: refunded and suspended from the radar for ${penalty.label}.`,
        resolvedAt: new Date(),
      })
      .where(eq(sessionReports.sessionId, filed.sessionId));

    const [therapist] = await db
      .select({ email: users.email, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, filed.therapistId))
      .limit(1);

    if (therapist) {
      const { sendTherapistMessage } = await import("@/lib/mail");
      await sendTherapistMessage({
        to: therapist.email,
        firstName: therapist.firstName,
        subject: "You have been taken off the Crisis Radar",
        body: `A patient reported that you did not join a session they had booked and paid for. They have been refunded, and you are off the radar for ${penalty.label}.\n\nIf this is wrong, reply to this email and we will look at it — the session record shows whether anyone joined the room.\n\nGoing on the radar means being ready to take a session within a minute. If you cannot be, switch yourself off; there is no penalty for being unavailable, only for being unavailable while advertised.\n\n— ${fullName(therapist.firstName, therapist.lastName, "")}`.trim(),
      });
    }
  }

  return { ok: true };
}

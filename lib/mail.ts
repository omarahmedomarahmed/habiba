import "server-only";

import { Resend } from "resend";

import { env, features } from "@/lib/env";
import { log, safeErrorMessage } from "@/lib/logger";
import type { NoteContent } from "@/lib/db/schema";

let resend: Resend | null = null;

function client(): Resend | null {
  if (!features.email) return null;
  resend ??= new Resend(env.resendApiKey);
  return resend;
}

/**
 * Every dynamic value in an email body goes through this.
 *
 * The old mail service interpolated patient names, note content and summaries
 * straight into HTML with `${}`. A patient whose name contains a quote or an
 * angle bracket broke the layout at best; at worst it was an injection point in
 * a message we send on the clinician's behalf.
 */
function esc(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * `footer` exists because the default line ("sent by your therapist") is a lie
 * on a message we send to a therapist ourselves — and a mismatched footer on a
 * transactional email is exactly what makes a real one look like a phish.
 */
function layout(title: string, body: string, footer?: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
    <div style="background:#ffffff;border-radius:16px;padding:28px 24px;border:1px solid #e2e8f0;">
      <div style="font-weight:700;font-size:15px;color:#0A2342;letter-spacing:-0.01em;margin-bottom:20px;">24Therapy</div>
      ${body}
    </div>
    <p style="text-align:center;color:#64748b;font-size:12px;line-height:1.6;margin:20px 0 0;">
      ${footer ?? "This message was sent by your therapist through 24Therapy.<br>If you were not expecting it, you can safely ignore it."}
    </p>
  </div>
</body></html>`;
}

async function send(opts: { to: string; subject: string; html: string }): Promise<boolean> {
  const mailer = client();
  if (!mailer) {
    log.warn("email skipped: RESEND_API_KEY not configured", { subject: opts.subject });
    return false;
  }
  try {
    const { error } = await mailer.emails.send({
      from: env.emailFrom,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    if (error) {
      log.warn("email send rejected", { reason: String(error.message ?? "unknown") });
      return false;
    }
    return true;
  } catch (error) {
    // Never log the body — it contains clinical content.
    log.warn("email send failed", { reason: safeErrorMessage(error) });
    return false;
  }
}

/**
 * The patient-facing session report.
 *
 * Deliberately narrow: summary, what was discussed, what to work on, and the
 * follow-up. Clinical impressions, the assessment and the objective section
 * stay in the chart — they are written for a clinician and can be actively
 * harmful read cold by the person they describe.
 */
export async function sendSessionReport(opts: {
  to: string;
  patientName: string;
  therapistName: string;
  note: NoteContent;
  sessionDate: Date;
}): Promise<boolean> {
  const { note } = opts;

  const points = note.talkingPoints.length
    ? `<p style="margin:22px 0 8px;font-weight:600;font-size:14px;">What we talked about</p>
       <ul style="margin:0;padding-left:20px;color:#334155;font-size:14px;line-height:1.7;">
         ${note.talkingPoints.map((p) => `<li>${esc(p)}</li>`).join("")}
       </ul>`
    : "";

  const recs = note.recommendations.length
    ? `<p style="margin:22px 0 8px;font-weight:600;font-size:14px;">Before we next meet</p>
       <ul style="margin:0;padding-left:20px;color:#334155;font-size:14px;line-height:1.7;">
         ${note.recommendations.map((r) => `<li>${esc(r)}</li>`).join("")}
       </ul>`
    : "";

  const followUp = note.followUp
    ? `<p style="margin:22px 0 0;font-size:14px;color:#334155;"><strong>Next session:</strong> ${esc(note.followUp)}</p>`
    : "";

  const html = layout(
    "Your session summary",
    `<p style="margin:0 0 4px;font-size:20px;font-weight:700;letter-spacing:-0.02em;">Hi ${esc(opts.patientName)},</p>
     <p style="margin:0 0 18px;color:#64748b;font-size:14px;">
       A summary of your session on ${esc(opts.sessionDate.toLocaleDateString(undefined, { dateStyle: "long" }))}, shared by ${esc(opts.therapistName)}.
     </p>
     ${note.summary ? `<p style="margin:0;color:#334155;font-size:15px;line-height:1.7;">${esc(note.summary)}</p>` : ""}
     ${points}
     ${recs}
     ${followUp}
     <p style="margin:26px 0 0;padding-top:18px;border-top:1px solid #e2e8f0;color:#64748b;font-size:13px;line-height:1.6;">
       Questions about anything here? Bring them to your next session — that is exactly what it is for.
       If you are in crisis and need help now, call or text 988.
     </p>`,
  );

  return send({ to: opts.to, subject: "Your session summary", html });
}

/**
 * A message from 24Therapy to a clinician — one person or the whole list.
 *
 * The body is written as plain text and escaped into paragraphs here. There is
 * no rich-text editor and no HTML passthrough on purpose: an admin-authored
 * `<a href>` in an email we send on our own behalf is a phishing template with
 * our branding on it, and the first person to abuse it would be whoever
 * compromises an admin account.
 */
export async function sendTherapistMessage(opts: {
  to: string;
  firstName: string;
  subject: string;
  body: string;
  /** Shown as a footer note so a broadcast does not read as a personal note. */
  announcement?: boolean;
}): Promise<boolean> {
  const paragraphs = opts.body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(
      (block) =>
        `<p style="margin:0 0 14px;color:#334155;font-size:15px;line-height:1.7;">${esc(block).replaceAll("\n", "<br>")}</p>`,
    )
    .join("");

  const html = layout(
    opts.subject,
    `<p style="margin:0 0 16px;font-size:18px;font-weight:700;letter-spacing:-0.01em;">Hi ${esc(opts.firstName || "there")},</p>
     ${paragraphs}
     <p style="margin:26px 0 0;padding-top:18px;border-top:1px solid #e2e8f0;color:#64748b;font-size:13px;line-height:1.6;">
       ${
         opts.announcement
           ? "This went to everyone using 24Therapy. Reply to this email if you need us — a person reads it."
           : "Reply to this email if you need us — a person reads it."
       }
     </p>`,
    "Sent by 24Therapy to the address on your clinician account.",
  );

  return send({ to: opts.to, subject: opts.subject, html });
}

export async function sendPasswordReset(opts: { to: string; url: string }): Promise<boolean> {
  const html = layout(
    "Reset your password",
    `<p style="margin:0 0 4px;font-size:20px;font-weight:700;">Reset your password</p>
     <p style="margin:0 0 20px;color:#64748b;font-size:14px;">This link works once and expires in one hour.</p>
     <a href="${esc(opts.url)}" style="display:inline-block;background:#1F5EFF;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:10px;">Choose a new password</a>
     <p style="margin:20px 0 0;color:#64748b;font-size:13px;">If you did not ask for this, nothing has changed and you can ignore this email.</p>`,
  );
  return send({ to: opts.to, subject: "Reset your 24Therapy password", html });
}

/**
 * The join link, with or without a price.
 *
 * One template rather than two. A paid invitation and a free one differ by a
 * price row and a verb; splitting them produces two copies of the same layout
 * that drift apart the first time a footer changes.
 */
export async function sendSessionInvite(opts: {
  to: string;
  therapistName: string;
  joinUrl: string;
  priceCents?: number;
}): Promise<boolean> {
  const price = Math.max(0, Math.round(opts.priceCents ?? 0));
  const paid = price > 0;
  const amount = `$${(price / 100).toFixed(price % 100 === 0 ? 0 : 2)}`;

  const priceRow = paid
    ? `<table role="presentation" width="100%" style="margin:0 0 20px;border-collapse:collapse;background:#0A2342;border-radius:12px;">
         <tr>
           <td style="padding:14px 16px;color:rgba(255,255,255,0.7);font-size:14px;">This session</td>
           <td style="padding:14px 16px;text-align:right;color:#ffffff;font-size:22px;font-weight:700;">${esc(amount)}</td>
         </tr>
       </table>`
    : "";

  const html = layout(
    "Your session link",
    `<p style="margin:0 0 4px;font-size:20px;font-weight:700;">Your session is ready</p>
     <p style="margin:0 0 20px;color:#64748b;font-size:14px;">${esc(opts.therapistName)} has invited you to join. No account or download needed — just tap the button.</p>
     ${priceRow}
     <a href="${esc(opts.joinUrl)}" style="display:inline-block;background:#2EC4B6;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:10px;">${paid ? `Pay ${esc(amount)} and join` : "Join the session"}</a>
     ${
       paid
         ? `<p style="margin:20px 0 0;color:#64748b;font-size:13px;line-height:1.6;">Payment is handled securely by Stripe and goes to your therapist. You will get a receipt by email.</p>`
         : ""
     }
     <p style="margin:${paid ? "10px" : "20px"} 0 0;color:#64748b;font-size:13px;">This link expires in 12 hours.</p>`,
  );

  return send({
    to: opts.to,
    subject: paid ? `Your therapy session — ${amount}` : "Your therapy session link",
    html,
  });
}

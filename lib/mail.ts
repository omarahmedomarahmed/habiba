import "server-only";

import { Resend } from "resend";

import { env, features } from "@/lib/env";
import { log, safeErrorMessage } from "@/lib/logger";
import { RTL_LANGUAGES, type NoteContent } from "@/lib/db/schema";

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
/**
 * Wording for the patient report, per language.
 *
 * A patient whose session was in Arabic gets an Arabic email. The note content
 * is already in their language — sending it wrapped in English chrome, laid out
 * left to right, would be a strange and slightly cold thing to receive after a
 * therapy session.
 *
 * Deliberately a small hand-written table rather than a translation call: these
 * are eight fixed strings that must be right every time, and a model producing
 * "Before we next meet" slightly differently on each send is worse than a
 * missing translation. Languages not listed fall back to English.
 */
const REPORT_STRINGS: Record<
  string,
  {
    subject: string;
    greeting: (name: string) => string;
    intro: (date: string, therapist: string) => string;
    discussed: string;
    before: string;
    next: string;
    closing: string;
    footer: string;
  }
> = {
  en: {
    subject: "Your session summary",
    greeting: (name) => `Hi ${name},`,
    intro: (date, therapist) => `A summary of your session on ${date}, shared by ${therapist}.`,
    discussed: "What we talked about",
    before: "Before we next meet",
    next: "Next session",
    closing:
      "Questions about anything here? Bring them to your next session — that is exactly what it is for. If you are in crisis and need help now, call or text 988.",
    footer:
      "This message was sent by your therapist through 24Therapy.<br>If you were not expecting it, you can safely ignore it.",
  },
  ar: {
    subject: "ملخّص جلستك",
    greeting: (name) => `مرحبًا ${name}،`,
    intro: (date, therapist) => `ملخّص جلستك بتاريخ ${date}، أرسله لك ${therapist}.`,
    discussed: "ما تحدّثنا عنه",
    before: "قبل لقائنا القادم",
    next: "الجلسة القادمة",
    closing:
      "لديك سؤال عن أي شيء هنا؟ اطرحه في جلستك القادمة — فهي لهذا الغرض تمامًا. إذا كنت تمرّ بأزمة وتحتاج مساعدة الآن، تواصل مع خط المساعدة في بلدك فورًا.",
    footer: "أرسلت هذه الرسالة من معالجك عبر 24Therapy.",
  },
  fr: {
    subject: "Le résumé de votre séance",
    greeting: (name) => `Bonjour ${name},`,
    intro: (date, therapist) => `Un résumé de votre séance du ${date}, partagé par ${therapist}.`,
    discussed: "Ce dont nous avons parlé",
    before: "D'ici notre prochaine séance",
    next: "Prochaine séance",
    closing:
      "Des questions sur ce qui précède ? Apportez-les à votre prochaine séance — c'est exactement à cela qu'elle sert. En cas de crise, contactez immédiatement un service d'urgence.",
    footer: "Ce message vous a été envoyé par votre thérapeute via 24Therapy.",
  },
  es: {
    subject: "El resumen de tu sesión",
    greeting: (name) => `Hola ${name}:`,
    intro: (date, therapist) => `Un resumen de tu sesión del ${date}, compartido por ${therapist}.`,
    discussed: "De lo que hablamos",
    before: "Antes de la próxima sesión",
    next: "Próxima sesión",
    closing:
      "¿Tienes dudas sobre algo de esto? Llévalas a tu próxima sesión, para eso está. Si estás en crisis y necesitas ayuda ahora, llama a un servicio de emergencia.",
    footer: "Tu terapeuta te ha enviado este mensaje a través de 24Therapy.",
  },
};

export async function sendSessionReport(opts: {
  to: string;
  patientName: string;
  therapistName: string;
  note: NoteContent;
  sessionDate: Date;
  /** The language the session was held in; the email follows it. */
  language?: string;
}): Promise<boolean> {
  const { note } = opts;
  const lang = opts.language ?? "en";
  const t = REPORT_STRINGS[lang] ?? REPORT_STRINGS.en!;
  const rtl = RTL_LANGUAGES.has(lang);
  const align = rtl ? "right" : "left";

  const padSide = rtl ? "padding-right" : "padding-left";

  const list = (heading: string, items: string[]) =>
    items.length
      ? `<p style="margin:22px 0 8px;font-weight:600;font-size:14px;text-align:${align};">${esc(heading)}</p>
         <ul style="margin:0;${padSide}:20px;color:#334155;font-size:14px;line-height:1.7;text-align:${align};">
           ${items.map((item) => `<li>${esc(item)}</li>`).join("")}
         </ul>`
      : "";

  const followUp = note.followUp
    ? `<p style="margin:22px 0 0;font-size:14px;color:#334155;text-align:${align};"><strong>${esc(t.next)}:</strong> ${esc(note.followUp)}</p>`
    : "";

  const html = layout(
    t.subject,
    `<div dir="${rtl ? "rtl" : "ltr"}" style="text-align:${align};">
       <p style="margin:0 0 4px;font-size:20px;font-weight:700;letter-spacing:-0.02em;">${esc(t.greeting(opts.patientName))}</p>
       <p style="margin:0 0 18px;color:#64748b;font-size:14px;">
         ${esc(t.intro(opts.sessionDate.toLocaleDateString(lang, { dateStyle: "long" }), opts.therapistName))}
       </p>
       ${note.summary ? `<p style="margin:0;color:#334155;font-size:15px;line-height:1.7;">${esc(note.summary)}</p>` : ""}
       ${list(t.discussed, note.talkingPoints)}
       ${list(t.before, note.recommendations)}
       ${followUp}
       <p style="margin:26px 0 0;padding-top:18px;border-top:1px solid #e2e8f0;color:#64748b;font-size:13px;line-height:1.6;">
         ${esc(t.closing)}
       </p>
     </div>`,
    t.footer,
  );

  return send({ to: opts.to, subject: t.subject, html });
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

/**
 * "Here is your record."
 *
 * Sent to the patient, never to whoever pressed the button. The body says who
 * asked and who did not read it, because an unexpected email containing a link
 * to your therapy notes should account for itself immediately or it reads as a
 * breach — or as a phish.
 */
export async function sendRecordExport(opts: {
  to: string;
  patientName: string;
  clinicianName: string;
  url: string;
  expiresInHours: number;
}): Promise<boolean> {
  const html = layout(
    "Your record",
    `<p style="margin:0 0 4px;font-size:20px;font-weight:700;">Your record is ready</p>
     <p style="margin:0 0 20px;color:#64748b;font-size:14px;line-height:1.6;">
       ${esc(opts.patientName)}, this is everything held about you in the chart kept by
       ${esc(opts.clinicianName)}: your details, every session, every note, and the
       transcript of anything that was recorded.
     </p>
     <a href="${esc(opts.url)}" style="display:inline-block;background:#1F5EFF;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:10px;">Open your record</a>
     <p style="margin:20px 0 0;color:#64748b;font-size:13px;line-height:1.6;">
       The link works for ${esc(opts.expiresInHours)} hours and then stops — save or print
       the page while it is open. It was generated automatically and nobody at
       24Therapy read it in order to send it to you.
     </p>
     <p style="margin:10px 0 0;color:#64748b;font-size:13px;line-height:1.6;">
       If you did not ask for this, tell ${esc(opts.clinicianName)} — and do not open
       the link, since it will be replaced the next time a copy is requested.
     </p>`,
    "This message was sent by 24Therapy at the request of you or your therapist.<br>It contains a private link — please do not forward it.",
  );

  return send({ to: opts.to, subject: "Your 24Therapy record", html });
}

/**
 * A walk-in address, sent to whoever asked for it on the radar.
 *
 * Nothing in here is supplied by the person who asked — only the destination
 * address is, and it is validated before we get here. That is what keeps an
 * anonymous, unauthenticated send from being a way to mail arbitrary text
 * through our domain.
 */
export async function sendWalkInDirections(opts: {
  to: string;
  therapistName: string;
  practiceName: string | null;
  address: string;
  mapsUrl: string;
}): Promise<boolean> {
  const html = layout(
    "Directions",
    `<p style="margin:0 0 4px;font-size:20px;font-weight:700;">${esc(opts.therapistName)}</p>
     <p style="margin:0 0 16px;color:#64748b;font-size:14px;">You asked for the address on 24Therapy.</p>
     <table role="presentation" width="100%" style="margin:0 0 18px;border-collapse:collapse;background:#f0fdfa;border-radius:12px;">
       <tr><td style="padding:14px 16px;">
         ${opts.practiceName ? `<p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#0f766e;">${esc(opts.practiceName)}</p>` : ""}
         <p style="margin:0;font-size:15px;line-height:1.6;color:#134e4a;">${esc(opts.address)}</p>
       </td></tr>
     </table>
     ${
       opts.mapsUrl
         ? `<a href="${esc(opts.mapsUrl)}" style="display:inline-block;background:#2EC4B6;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:10px;">Open directions</a>`
         : ""
     }
     <p style="margin:20px 0 0;color:#64748b;font-size:13px;line-height:1.6;">
       Turning up is not an appointment — this clinician accepts walk-ins, but they may
       be with someone. Booking a session on the radar is the only way to be certain.
     </p>
     <p style="margin:10px 0 0;color:#64748b;font-size:13px;line-height:1.6;">
       If you are in immediate danger, call your local emergency number.
     </p>`,
    "You asked for this address on 24Therapy's Crisis Radar.<br>We did not store your email and you are not signed up to anything.",
  );

  return send({ to: opts.to, subject: `Directions to ${opts.therapistName}`, html });
}

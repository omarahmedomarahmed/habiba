import "server-only";

import { Resend } from "resend";

import { env, features } from "@/lib/env";
import { log, safeErrorMessage } from "@/lib/logger";
import { RTL_LANGUAGES, type NoteContent } from "@/lib/db/schema";
import { formatCalendarDate, resolveZone } from "@/lib/scheduling/tz";
import type { Words } from "@/lib/i18n/message-words";
import type { MessageKey } from "@/lib/i18n/messages";
import { footerKeys, type Footing } from "@/lib/notify/readers";

/**
 * 🔴 Ruling 8: the words for one email, in the language the caller resolved
 * for its recipient (`wordsFor`), with admin overrides. Absent is the default.
 */
async function mailWords(locale: string | null | undefined): Promise<Words> {
  const { wordsIn } = await import("@/lib/i18n/message-words");
  return wordsIn(locale);
}

/** A footer of two dictionary lines, escaped, the way the shell sets them. */
function footerOf(words: Words, first: MessageKey, second: MessageKey): string {
  return `${esc(words.t(first))}<br>${esc(words.t(second))}`;
}

/** 🔴 B23: the footer for this reader and this occasion (`lib/notify/readers.ts`). */
function footerFor(words: Words, footing: Footing): string {
  return footerOf(words, ...footerKeys(footing));
}

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
 * 🔴 `footer` IS REQUIRED. It used to default to "sent by your therapist",
 * which was a lie on every message we send ourselves: a clinician's own
 * password reset went out with it (B41). A mismatched footer on a
 * transactional email is exactly what makes a real one look like a phish, so
 * every sender names its reader (`footerFor`) or writes its own line.
 */
function layout(title: string, body: string, footer: string, words?: Words): string {
  /* 🔴 Ruling 8: an Arabic message reads right to left, shell and all. */
  const rtl = words?.locale === "ar";
  const content = rtl ? `<div dir="rtl" style="text-align:right;">${body}</div>` : body;
  return `<!doctype html>
<html${rtl ? ' dir="rtl" lang="ar"' : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
    <div style="background:#ffffff;border-radius:16px;padding:28px 24px;border:1px solid #e2e8f0;">
      <div style="font-weight:700;font-size:15px;color:#0A2342;letter-spacing:-0.01em;margin-bottom:20px;">24Therapy</div>
      ${content}
    </div>
    <p style="text-align:center;color:#64748b;font-size:12px;line-height:1.6;margin:20px 0 0;">
      ${footer}
    </p>
  </div>
</body></html>`;
}

async function send(opts: {
  to: string;
  subject: string;
  html: string;
  /** Blind copy. Never shown to the primary recipient. */
  bcc?: string;
  attachments?: { filename: string; content: string }[];
}): Promise<boolean> {
  /* 🔴 0170: an invented address reaches nobody. Kept in the outbox, reported as sent. */
  const { isInventedEmail, keep } = await import("@/lib/notify/outbox");
  if (isInventedEmail(opts.to)) {
    await keep({ channel: "email", to: opts.to, subject: opts.subject, body: opts.html, reason: "invented address" });
    return true;
  }
  const mailer = client();
  if (!mailer) {
    log.warn("email skipped: RESEND_API_KEY not configured", { subject: opts.subject });
    return false;
  }
  try {
    const { error } = await mailer.emails.send({
      from: env.emailFrom,
      to: opts.to,
      ...(opts.bcc && opts.bcc !== opts.to ? { bcc: opts.bcc } : {}),
      ...(opts.attachments ? { attachments: opts.attachments } : {}),
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
      "Questions about anything here? Bring them to your next session. That is exactly what it is for. If you are in crisis and need help now, call your local emergency number.",
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
      "لديك سؤال عن أي شيء هنا؟ اطرحه في جلستك القادمة، فهي لهذا الغرض تمامًا. إذا كنت تمرّ بأزمة وتحتاج مساعدة الآن، تواصل مع خط المساعدة في بلدك فورًا.",
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
      "Des questions sur ce qui précède ? Apportez-les à votre prochaine séance, c'est exactement à cela qu'elle sert. En cas de crise, contactez immédiatement un service d'urgence.",
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
  /**
   * The patient's zone, then the clinician's. 11R.1 — a 23:00 Cairo session is
   * the previous day in UTC, and "your session on the 11th" about a session
   * the patient remembers having on the 12th reads as somebody else's email.
   */
  timezone?: string | null;
  /** The language the session was held in; the email follows it. */
  language?: string;
}): Promise<boolean> {
  const { note } = opts;
  const lang = opts.language ?? "en";
  const t = REPORT_STRINGS[lang] ?? REPORT_STRINGS.en!;
  const rtl = RTL_LANGUAGES.has(lang);
  const align = rtl ? "right" : "left";

  /*
   * The steps, and the line about what happens next.
   *
   * This email used to be prose and nothing else, and prose is read once. The
   * thing a patient goes back to their inbox for on Thursday is the short list
   * of what they said they would try — so it gets its own block, with the
   * numbers a person can count, rather than being buried in the third
   * paragraph.
   *
   * `patientSteps` and `patientNext` are written to the patient by the same
   * pass that writes the note, and the clinician signs them separately before
   * anything is sent. `recommendations` and `followUp` — the clinician's own
   * lists, about the patient rather than to them — are not in this file's
   * reach and never were.
   */
  const steps =
    note.patientSteps.length > 0
      ? `<div style="margin:22px 0 0;padding:16px 18px;background:#f0fdfa;border-radius:12px;">
           <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#0f766e;text-align:${align};">${esc(t.before)}</p>
           ${note.patientSteps
             .map(
               (step) =>
                 `<p style="margin:0 0 8px;font-size:15px;line-height:1.65;color:#134e4a;text-align:${align};">${esc(step)}</p>`,
             )
             .join("")}
         </div>`
      : "";

  const nextLine = note.patientNext
    ? `<p style="margin:18px 0 0;font-size:14px;line-height:1.7;color:#334155;text-align:${align};"><strong>${esc(t.next)}:</strong> ${esc(note.patientNext)}</p>`
    : "";

  const html = layout(
    t.subject,
    `<div dir="${rtl ? "rtl" : "ltr"}" style="text-align:${align};">
       <p style="margin:0 0 4px;font-size:20px;font-weight:700;letter-spacing:-0.02em;">${esc(t.greeting(opts.patientName))}</p>
       <p style="margin:0 0 18px;color:#64748b;font-size:14px;">
         ${esc(t.intro(formatCalendarDate(opts.sessionDate, resolveZone(opts.timezone).name, lang), opts.therapistName))}
       </p>
       ${
         /*
          * The brief, and only the brief.
          *
          * `summary`, `talkingPoints` and `recommendations` are written for a
          * clinician — "presented as guarded", "query comorbid" — and this
          * email used to carry all three. `patientBrief` is the section the
          * model writes *to* the patient in plain words, and it is the only
          * clinical text that ever leaves the practice. The fallback exists
          * for notes generated before the brief did.
          */
         note.patientBrief || note.summary
           ? `<div style="margin:0;color:#334155;font-size:15px;line-height:1.75;">${esc(
               note.patientBrief || note.summary,
             )
               .split("\n")
               .filter(Boolean)
               .map((paragraph) => `<p style="margin:0 0 12px;">${paragraph}</p>`)
               .join("")}</div>`
           : ""
       }
       ${steps}
       ${nextLine}
       <p style="margin:26px 0 0;padding-top:18px;border-top:1px solid #e2e8f0;color:#64748b;font-size:13px;line-height:1.6;">
         ${esc(t.closing)}
       </p>
     </div>`,
    t.footer,
  );

  return send({ to: opts.to, subject: t.subject, html });
}

/**
 * "Your summary is written, and it is waiting behind one question."
 *
 * The rating is a gate in front of the summary, which is the only reason the
 * rating rate is not eight percent. But a gate makes a failure mode: somebody
 * closes the tab, and then nobody ever tells them the thing they were promised
 * is now sitting there. This is the one email that closes that loop.
 *
 * Deliberately not a review request. Nothing here says "rate your therapist"
 * or asks how we did — it says a summary exists, and the link is the way to it.
 * A patient who does not want to answer anything about their session should not
 * be receiving marketing about it a day later, so this is sent exactly once
 * (`ratingReminderAt`) and never followed up.
 */
export async function sendRatingReminder(opts: {
  to: string;
  therapistName: string;
  therapistFirstName: string;
  url: string;
  sessionDate: Date;
  /** The patient's zone, then the clinician's. 11R.1. */
  timezone?: string | null;
  /** 🔴 Ruling 8: the patient's language, from `wordsFor`. */
  locale?: string | null;
}): Promise<boolean> {
  const words = await mailWords(opts.locale);
  const { t } = words;
  const date = formatCalendarDate(opts.sessionDate, resolveZone(opts.timezone).name, words.locale);
  const html = layout(
    t("pmsg.rating.subject"),
    `<p style="margin:0 0 4px;font-size:20px;font-weight:700;letter-spacing:-0.02em;">${esc(t("pmsg.rating.title"))}</p>
     <p style="margin:0 0 20px;color:#64748b;font-size:14px;line-height:1.7;">
       ${esc(t("pmsg.rating.body", { therapist: opts.therapistFirstName, date }))}
     </p>
     <a href="${esc(opts.url)}" style="display:inline-block;background:#2EC4B6;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:10px;">${esc(t("pmsg.rating.button"))}</a>
     <p style="margin:20px 0 0;color:#64748b;font-size:13px;line-height:1.7;">
       ${esc(t("pmsg.rating.ask", { therapist: opts.therapistFirstName }))}
     </p>
     <p style="margin:10px 0 0;color:#94a3b8;font-size:12px;line-height:1.6;">
       ${esc(t("pmsg.rating.expiry"))}
     </p>`,
    footerOf(words, "pmsg.rating.footer", "pmsg.mail.ignore"),
    words,
  );

  return send({ to: opts.to, subject: t("pmsg.rating.subject"), html });
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
  /**
   * 🔴 Ruling 8: the clinician's language, for the greeting and the footer.
   * An admin's own subject and body go as they were typed.
   */
  locale?: string | null;
}): Promise<boolean> {
  const words = await mailWords(opts.locale);
  const { t } = words;
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
    `<p style="margin:0 0 16px;font-size:18px;font-weight:700;letter-spacing:-0.01em;">${esc(
      opts.firstName ? t("tmsg.mail.hi", { name: opts.firstName }) : t("tmsg.mail.hiThere"),
    )}</p>
     ${paragraphs}
     <p style="margin:26px 0 0;padding-top:18px;border-top:1px solid #e2e8f0;color:#64748b;font-size:13px;line-height:1.6;">
       ${esc(opts.announcement ? t("tmsg.mail.announcement") : t("tmsg.mail.reply"))}
     </p>`,
    esc(t("tmsg.mail.footer")),
    words,
  );

  return send({ to: opts.to, subject: opts.subject, html });
}

export async function sendPasswordReset(opts: {
  to: string;
  url: string;
  /** 🔴 Ruling 8: the account holder's language, when they have a `users` row. */
  locale?: string | null;
}): Promise<boolean> {
  const words = await mailWords(opts.locale);
  const { t } = words;
  const html = layout(
    t("tmsg.reset.title"),
    `<p style="margin:0 0 4px;font-size:20px;font-weight:700;">${esc(t("tmsg.reset.title"))}</p>
     <p style="margin:0 0 20px;color:#64748b;font-size:14px;">${esc(t("tmsg.reset.expiry"))}</p>
     <a href="${esc(opts.url)}" style="display:inline-block;background:#2EC4B6;color:#0A2342;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:10px;">${esc(t("tmsg.reset.button"))}</a>
     <p style="margin:20px 0 0;color:#64748b;font-size:13px;">${esc(t("tmsg.reset.ignore"))}</p>`,
    /* 🔴 B41: they asked for it. Clinicians, staff, managers and partners share this template. */
    footerFor(words, { reader: "clinician", occasion: "asked" }),
    words,
  );
  return send({ to: opts.to, subject: t("tmsg.reset.subject"), html });
}

/** The role an account link names, as its dictionary key. */
const ROLE_KEY: Record<string, MessageKey> = {
  admin: "mail.role.admin",
  viewer: "mail.role.viewer",
  developer: "mail.role.developer",
  staff: "mail.role.staff",
  manager: "mail.role.manager",
  super_admin: "mail.role.owner",
};

const INVITE_KEY: Record<"staff" | "manager" | "company" | "partner", MessageKey> = {
  staff: "mail.account.invite.staff",
  manager: "mail.account.invite.manager",
  company: "mail.account.invite.company",
  partner: "mail.account.invite.partner",
};

/**
 * 🔴 B24: AN ACCOUNT INVITATION SAYS WHOSE ACCOUNT, AND IN WHAT ROLE.
 *
 * The console's invitations to a practice manager, a company admin, a partner
 * developer and a member of our own staff all read "Choose your password. The
 * link works once." and nothing else, so the person could not tell which
 * organisation had added them, as what, or where they would sign in. Unsolicited
 * mail that asks for a password and names nobody is the shape of a phish. One
 * builder for every portal, so a fifth invitation cannot drift back to that.
 *
 * W2-X06: the link sets the reader's own password. Nobody else ever types it,
 * operators included.
 */
export async function sendAccountLink(opts: {
  to: string;
  url: string;
  reader: "staff" | "manager" | "company" | "partner";
  purpose: "invite" | "reset";
  /** The practice, company or partner. Unused for our own staff. */
  organisation: string | null;
  role: string;
  /** Their own name, for the greeting, when the console was given one. */
  name?: string | null;
  /** The full address of the sign-in page for their portal. */
  signIn: string;
  days: number;
  locale?: string | null;
}): Promise<boolean> {
  const words = await mailWords(opts.locale);
  const { t } = words;
  const org = opts.organisation?.trim() || "24Therapy";
  const role = t(ROLE_KEY[opts.role] ?? "mail.role.member");
  const lead =
    opts.purpose === "reset"
      ? t("mail.account.reset", { org })
      : t(INVITE_KEY[opts.reader], { org, role });
  const next =
    opts.purpose === "reset"
      ? t("mail.account.resetNext")
      : t("mail.account.inviteNext", { days: opts.days, signIn: opts.signIn });
  const subject =
    opts.purpose === "reset" ? t("tmsg.reset.subject") : t("mail.account.subject", { org });
  const html = layout(
    subject,
    `<p style="margin:0 0 12px;font-size:18px;font-weight:700;">${esc(opts.name ? t("pmsg.hi", { name: opts.name }) : t("pmsg.hiThere"))}</p>
     <p style="margin:0 0 12px;color:#334155;font-size:15px;line-height:1.6;">${esc(lead)}</p>
     <p style="margin:0 0 20px;color:#64748b;font-size:14px;line-height:1.6;">${esc(next)}</p>
     <a href="${esc(opts.url)}" style="display:inline-block;background:#2EC4B6;color:#0A2342;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:10px;">${esc(t("mail.account.button"))}</a>`,
    footerFor(words, { reader: opts.reader, occasion: opts.purpose === "reset" ? "asked" : "account" }),
    words,
  );
  return send({ to: opts.to, subject, html });
}

/**
 * A claim verification code. §3 step 5.
 *
 * Deliberately says nothing about who holds the record or which clinician
 * wrote it. Somebody reading this over a shoulder — or a shared family inbox —
 * learns that a code exists, not that this person is in therapy or with whom.
 * The redacted name is shown on the screen, to somebody who is already signed
 * in, and never in an email.
 */
export async function sendClaimCode(opts: {
  to: string;
  code: string;
  /** 🔴 Ruling 8: the patient's language. */
  locale?: string | null;
}): Promise<boolean> {
  const words = await mailWords(opts.locale);
  const { t } = words;
  const html = layout(
    t("pmsg.claimMail.title"),
    `<p style="margin:0 0 4px;font-size:20px;font-weight:700;">${esc(t("pmsg.claimMail.heading"))}</p>
     <p style="margin:0 0 20px;color:#64748b;font-size:14px;">${esc(t("pmsg.claimMail.expiry"))}</p>
     <p style="margin:0 0 20px;font-size:32px;font-weight:700;letter-spacing:6px;" dir="ltr">${esc(opts.code)}</p>
     <p style="margin:20px 0 0;color:#64748b;font-size:13px;">${esc(t("pmsg.claimMail.ignore"))}</p>`,
    /* 🔴 B52: a code they asked for, not an appointment they booked. */
    footerFor(words, { reader: "patient", occasion: "asked" }),
    words,
  );
  return send({ to: opts.to, subject: t("pmsg.code.verifySubject"), html });
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
  /** 🔴 Ruling 8: the patient's language, from `wordsFor`. */
  locale?: string | null;
}): Promise<boolean> {
  const words = await mailWords(opts.locale);
  const { t } = words;
  const price = Math.max(0, Math.round(opts.priceCents ?? 0));
  const paid = price > 0;
  /* Pounds first, dollars beside them: an email has no hover. */
  const { moneyText } = await import("@/lib/money/text");
  const amount = await moneyText(price);
  const end = words.locale === "ar" ? "left" : "right";

  const priceRow = paid
    ? `<table role="presentation" width="100%" style="margin:0 0 20px;border-collapse:collapse;background:#0A2342;border-radius:12px;">
         <tr>
           <td style="padding:14px 16px;color:rgba(255,255,255,0.7);font-size:14px;">${esc(t("pmsg.inviteMail.price"))}</td>
           <td style="padding:14px 16px;text-align:${end};color:#ffffff;font-size:22px;font-weight:700;">${esc(amount)}</td>
         </tr>
       </table>`
    : "";

  const html = layout(
    t("pmsg.inviteMail.title"),
    `<p style="margin:0 0 4px;font-size:20px;font-weight:700;">${esc(t("pmsg.inviteMail.heading"))}</p>
     <p style="margin:0 0 20px;color:#64748b;font-size:14px;">${esc(t("pmsg.inviteMail.body", { therapist: opts.therapistName }))}</p>
     ${priceRow}
     <a href="${esc(opts.joinUrl)}" style="display:inline-block;background:#2EC4B6;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:10px;">${esc(paid ? t("pmsg.inviteMail.pay", { amount }) : t("pmsg.inviteMail.join"))}</a>
     ${
       paid
         ? `<p style="margin:20px 0 0;color:#64748b;font-size:13px;line-height:1.6;">${esc(t("pmsg.inviteMail.stripe"))}</p>`
         : ""
     }
     <p style="margin:${paid ? "10px" : "20px"} 0 0;color:#64748b;font-size:13px;">${esc(t("pmsg.inviteMail.expiry"))}</p>`,
    footerFor(words, { reader: "patient", occasion: "therapist" }),
    words,
  );

  return send({
    to: opts.to,
    subject: paid ? t("pmsg.inviteMail.subjectPaid", { amount }) : t("pmsg.inviteMail.subject"),
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
  /** Their clinician's name; absent says "your therapist" in their language. */
  clinicianName?: string | null;
  url: string;
  expiresInHours: number;
  /** Blind copy of the same message, for the person who requested it. */
  copyTo?: string;
  /** 🔴 Ruling 8: the patient's language, from `wordsFor`. */
  locale?: string | null;
}): Promise<boolean> {
  const words = await mailWords(opts.locale);
  const { t } = words;
  const clinician = opts.clinicianName || t("pmsg.yourTherapistLower");
  const html = layout(
    t("pmsg.exportMail.title"),
    `<p style="margin:0 0 4px;font-size:20px;font-weight:700;">${esc(t("pmsg.exportMail.heading"))}</p>
     <p style="margin:0 0 20px;color:#64748b;font-size:14px;line-height:1.6;">
       ${esc(t("pmsg.exportMail.body", { patient: opts.patientName, clinician }))}
     </p>
     <a href="${esc(opts.url)}" style="display:inline-block;background:#2EC4B6;color:#0A2342;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:10px;">${esc(t("pmsg.openRecord"))}</a>
     <p style="margin:20px 0 0;color:#64748b;font-size:13px;line-height:1.6;">
       ${esc(t("pmsg.exportMail.expiry", { hours: opts.expiresInHours }))}
     </p>
     <p style="margin:10px 0 0;color:#64748b;font-size:13px;line-height:1.6;">
       ${esc(t("pmsg.exportMail.notYou", { clinician }))}
     </p>`,
    footerOf(words, "pmsg.exportMail.footer", "pmsg.exportMail.private"),
    words,
  );

  return send({ to: opts.to, bcc: opts.copyTo, subject: t("pmsg.exportMail.subject"), html });
}

/**
 * One clinician's session and note history, to a named address.
 *
 * The body carries the stated reason and the requesting address, and the data
 * itself is an attached CSV rather than text in the message — a spreadsheet is
 * what the recipient of a records request actually needs, and it keeps the
 * message itself readable by a person deciding whether to open the attachment.
 */
export async function sendClinicianHistory(opts: {
  to: string;
  copyTo: string;
  clinicianName: string;
  reason: string;
  csv: string;
  summary: string;
}): Promise<boolean> {
  const html = layout(
    "Records request",
    `<p style="margin:0 0 4px;font-size:20px;font-weight:700;">Records request for ${esc(opts.clinicianName)}</p>
     <p style="margin:0 0 16px;color:#64748b;font-size:14px;line-height:1.7;">
       Attached is the session and note history held by 24Therapy for this clinician.
     </p>
     <div style="margin:0 0 16px;padding:14px 16px;background:#f8fafc;border-radius:12px;font-size:14px;line-height:1.7;color:#334155;">
       ${esc(opts.summary)}
     </div>
     <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;">Stated reason</p>
     <p style="margin:0 0 20px;color:#334155;font-size:14px;line-height:1.7;">${esc(opts.reason)}</p>
     <p style="margin:0;color:#64748b;font-size:13px;line-height:1.7;">
       This disclosure is recorded in our audit log with the requesting administrator, the address
       it was sent to and the reason above. The clinician has been told that it happened.
     </p>`,
    "Sent by 24Therapy in response to a formal request.",
  );

  return send({
    to: opts.to,
    bcc: opts.copyTo,
    subject: `24Therapy records for ${opts.clinicianName}`,
    html,
    attachments: [
      {
        filename: `24therapy-${opts.clinicianName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`,
        content: Buffer.from(opts.csv, "utf8").toString("base64"),
      },
    ],
  });
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
  /**
   * 🔴 Ruling 8: an anonymous visitor has no saved choice, so this is the
   * language of the page they asked from.
   */
  locale?: string | null;
}): Promise<boolean> {
  const words = await mailWords(opts.locale);
  const { t } = words;
  const html = layout(
    t("pmsg.walkIn.title"),
    `<p style="margin:0 0 4px;font-size:20px;font-weight:700;">${esc(opts.therapistName)}</p>
     <p style="margin:0 0 16px;color:#64748b;font-size:14px;">${esc(t("pmsg.walkIn.asked"))}</p>
     <table role="presentation" width="100%" style="margin:0 0 18px;border-collapse:collapse;background:#f0fdfa;border-radius:12px;">
       <tr><td style="padding:14px 16px;">
         ${opts.practiceName ? `<p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#0f766e;">${esc(opts.practiceName)}</p>` : ""}
         <p style="margin:0;font-size:15px;line-height:1.6;color:#134e4a;">${esc(opts.address)}</p>
       </td></tr>
     </table>
     ${
       opts.mapsUrl
         ? `<a href="${esc(opts.mapsUrl)}" style="display:inline-block;background:#2EC4B6;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:10px;">${esc(t("pmsg.walkIn.open"))}</a>`
         : ""
     }
     <p style="margin:20px 0 0;color:#64748b;font-size:13px;line-height:1.6;">
       ${esc(t("pmsg.walkIn.note"))}
     </p>
     <p style="margin:10px 0 0;color:#64748b;font-size:13px;line-height:1.6;">
       ${esc(t("pmsg.walkIn.danger"))}
     </p>`,
    footerOf(words, "pmsg.walkIn.footer", "pmsg.walkIn.footer2"),
    words,
  );

  return send({ to: opts.to, subject: t("pmsg.walkIn.subject", { therapist: opts.therapistName }), html });
}

/**
 * The email channel behind `lib/notify`. PLAN.md 11.7.
 *
 * Exported here rather than reimplemented there, so the notification seam does
 * not become a second mail implementation with its own idea of a footer, a
 * from-address and an escaping rule.
 *
 * 🔴 B23: the footer follows `footing`, who reads it and why. It was one line
 * for everybody, "about an appointment you booked", which a practice manager's
 * invitation, a company's receipt and the back office's code all carried.
 */
export async function sendNotification(opts: {
  to: string;
  subject: string;
  /** Plain text. Paragraphs split on a blank line. */
  body: string;
  link?: { label: string; url: string } | null;
  /** 🔴 Ruling 8: the language the caller wrote the subject and body in. */
  locale?: string | null;
  /** Who reads it and why, for the footer: `footingFor(kind)` in `lib/notify/readers.ts`. */
  footing: Footing;
}): Promise<boolean> {
  const words = await mailWords(opts.locale);
  const paragraphs = opts.body
    .split("\n\n")
    .map((line) => `<p style="margin:0 0 12px;line-height:1.6;">${esc(line)}</p>`)
    .join("");

  const button = opts.link
    ? `<p style="margin:20px 0 0"><a href="${esc(opts.link.url)}" style="display:inline-block;background:#0A2342;color:#ffffff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:600;">${esc(opts.link.label)}</a></p>`
    : "";

  return send({
    to: opts.to,
    subject: opts.subject,
    html: layout(
      opts.subject,
      paragraphs + button,
      footerFor(words, opts.footing),
      words,
    ),
  });
}

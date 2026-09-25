/**
 * 🔴 Task 40: EVERY WHATSAPP TEMPLATE META MUST APPROVE, IN BOTH LANGUAGES.
 *
 * Meta sends a business-initiated WhatsApp message only from a template it
 * approved in advance: a fixed body with numbered variables, in each language
 * it will be sent in. This is the list to submit, word for word, and the one
 * place `lib/notify/whatsapp.ts` reads a template from. `verify:whatsapp`
 * proves every sender passes the number of variables its template takes, and
 * that both bodies use exactly those variables.
 *
 * ## Approved is a fact about Meta, so it is configuration
 *
 * `WHATSAPP_APPROVED_TEMPLATES` names the templates Meta has approved, comma
 * separated (`session_confirmed,phone_verify`). A template not on it is never
 * sent: Meta would refuse it and the message would be lost. `notify()` then
 * sends the email, and when nothing else carries it, writes an in-app notice,
 * so an unapproved template never drops a message silently.
 *
 * No clinical content in any body: a time, a name, an amount, a code, a link.
 * Categories follow Meta's own: `authentication` for a one-time code (one
 * variable, no link), `utility` for everything a person's own action caused.
 */

export type TemplateCategory = "utility" | "authentication";

export type WhatsappTemplate = {
  /** The name it is registered under at Meta. */
  name: string;
  category: TemplateCategory;
  /** How many numbered variables the body takes, `{{1}}` onwards. */
  variables: number;
  en: string;
  ar: string;
};

/** Keyed by `Message.kind`. A kind with no entry is email and in-app only. */
export const WHATSAPP_TEMPLATES = {
  "booking.confirmed": {
    name: "session_confirmed",
    category: "utility",
    variables: 2,
    en: "Your session with {{1}} is confirmed for {{2}}.",
    ar: "تم تأكيد جلستك مع {{1}} في {{2}}.",
  },
  "booking.reminder": {
    name: "session_reminder",
    category: "utility",
    variables: 2,
    en: "Reminder: your session with {{1}} is {{2}}.",
    ar: "تذكير: جلستك مع {{1}} في {{2}}.",
  },
  "booking.cancelled": {
    name: "session_cancelled",
    category: "utility",
    variables: 2,
    en: "Your session with {{1}} on {{2}} has been cancelled. Details are in the app.",
    ar: "أُلغيت جلستك مع {{1}} في {{2}}. التفاصيل في التطبيق.",
  },
  "booking.rescheduled": {
    name: "session_rescheduled",
    category: "utility",
    variables: 2,
    en: "Your session with {{1}} has moved to {{2}}. There is nothing more to pay.",
    ar: "نُقلت جلستك مع {{1}} إلى {{2}}. لا يوجد ما تدفعه مرة أخرى.",
  },
  "booking.patient_cancelled": {
    name: "patient_cancelled",
    category: "utility",
    variables: 1,
    en: "A patient cancelled their session on {{1}}. Details are in your bookings.",
    ar: "ألغى أحد المرضى جلسته في {{1}}. التفاصيل في حجوزاتك.",
  },
  "booking.patient_moved": {
    name: "patient_moved",
    category: "utility",
    variables: 1,
    en: "A patient moved their session to {{1}}. Details are in your bookings.",
    ar: "نقل أحد المرضى جلسته إلى {{1}}. التفاصيل في حجوزاتك.",
  },
  "session.started": {
    name: "session_started",
    category: "utility",
    variables: 1,
    en: "{{1}} is in the room and waiting for you.",
    ar: "{{1}} في الغرفة وينتظرك.",
  },
  "session.summary_ready": {
    name: "summary_ready",
    category: "utility",
    variables: 2,
    en: "Your summary from {{1}} is ready. Open it here: {{2}}",
    ar: "ملخصك من {{1}} جاهز. افتحه من هنا: {{2}}",
  },
  "session.invite": {
    name: "session_invite",
    category: "utility",
    variables: 1,
    en: "{{1}} has invited you to a session on 24Therapy.",
    ar: "دعاك {{1}} إلى جلسة على 24Therapy.",
  },
  "claim.code": {
    name: "claim_code",
    category: "authentication",
    variables: 1,
    en: "{{1}} is your 24Therapy verification code.",
    ar: "{{1}} هو رمز التحقق الخاص بك في 24Therapy.",
  },
  "claim.invite": {
    name: "claim_invite",
    category: "utility",
    variables: 1,
    en: "{{1}} has invited you to set up your 24Therapy account.",
    ar: "دعاك {{1}} إلى إعداد حسابك في 24Therapy.",
  },
  "password.reset_code": {
    name: "password_reset_code",
    category: "authentication",
    variables: 1,
    en: "{{1}} is your code to set a new password.",
    ar: "{{1}} هو رمزك لتعيين كلمة مرور جديدة.",
  },
  "phone.verify": {
    name: "phone_verify",
    category: "authentication",
    variables: 1,
    en: "Your 24Therapy code is {{1}}.",
    ar: "رمزك في 24Therapy هو {{1}}.",
  },
  "homework.set": {
    name: "homework_set",
    category: "utility",
    variables: 1,
    en: "{{1}} has set you something to try before your next session. It is in your 24Therapy app.",
    ar: "ترك لك {{1}} شيئًا تجربه قبل جلستك القادمة. تجده في تطبيق 24Therapy.",
  },
  "assessment.sent": {
    name: "assessment_sent",
    category: "utility",
    variables: 1,
    en: "{{1}} has sent you a few questions to answer in your 24Therapy app.",
    ar: "أرسل لك {{1}} بعض الأسئلة لتجيب عنها في تطبيق 24Therapy.",
  },
  "payment.submitted": {
    name: "payment_submitted",
    category: "utility",
    variables: 1,
    en: "We have your transfer of {{1}}. Somebody is checking it now.",
    ar: "وصلنا تحويلك بقيمة {{1}}. يراجعه أحد فريقنا الآن.",
  },
  "payment.confirmed": {
    name: "payment_confirmed",
    category: "utility",
    variables: 1,
    en: "Your payment of {{1}} is confirmed.",
    ar: "تم تأكيد دفعتك بقيمة {{1}}.",
  },
  "payment.rejected": {
    name: "payment_rejected",
    category: "utility",
    variables: 1,
    en: "We could not match your transfer of {{1}}. Open the payment page to send the details again.",
    ar: "لم نتمكن من مطابقة تحويلك بقيمة {{1}}. افتح صفحة الدفع لإرسال التفاصيل مرة أخرى.",
  },
  "payout.sent": {
    name: "payout_sent",
    category: "utility",
    variables: 1,
    en: "Your withdrawal of {{1}} is on its way. The receipt is on your earnings page.",
    ar: "سحبك بقيمة {{1}} في الطريق إليك. الإيصال في صفحة أرباحك.",
  },
  "payout.rejected": {
    name: "payout_rejected",
    category: "utility",
    variables: 1,
    en: "Your withdrawal of {{1}} was not sent. The reason is on your earnings page.",
    ar: "لم يُرسَل سحبك بقيمة {{1}}. السبب في صفحة أرباحك.",
  },
  "payout.returned": {
    name: "payout_returned",
    category: "utility",
    variables: 1,
    en: "Your withdrawal of {{1}} came back. The money is in your balance again.",
    ar: "عاد سحبك بقيمة {{1}}. المبلغ في رصيدك من جديد.",
  },
  "support.closed": {
    name: "support_reply",
    category: "utility",
    variables: 3,
    en: "We have answered your message {{1}}. Read the reply at {{2}} with the code {{3}}.",
    ar: "رددنا على رسالتك {{1}}. اقرأ الرد على {{2}} باستخدام الرمز {{3}}.",
  },
  /* B33: the acknowledgement. Email goes at once; WhatsApp once this name is approved. */
  "support.received": {
    name: "support_received",
    category: "utility",
    variables: 3,
    en: "We have your message {{1}}. See where it stands at {{2}} with the code {{3}}.",
    ar: "وصلتنا رسالتك {{1}}. اعرف أين وصلت على {{2}} باستخدام الرمز {{3}}.",
  },
  "checkin.asking": {
    name: "checkin_asking",
    category: "utility",
    variables: 1,
    en: "Hi {{1}}, how are you doing? You can turn these messages off in the app.",
    ar: "مرحبًا {{1}}، كيف حالك؟ يمكنك إيقاف هذه الرسائل من التطبيق.",
  },
} as const satisfies Record<string, WhatsappTemplate>;

export type TemplatedKind = keyof typeof WHATSAPP_TEMPLATES;

/** The template for a message kind, or null when it has none. */
export function templateFor(kind: string): WhatsappTemplate | null {
  return (WHATSAPP_TEMPLATES as Record<string, WhatsappTemplate>)[kind] ?? null;
}

/**
 * The template names Meta has approved, from `WHATSAPP_APPROVED_TEMPLATES`.
 *
 * A bare name is approved in the default language (`WHATSAPP_TEMPLATE_LANGUAGE`);
 * `name:en` says it is approved in that language as well. Ruling 8.
 */
function approvedTemplates(env: string | undefined = process.env.WHATSAPP_APPROVED_TEMPLATES): Set<string> {
  return new Set(
    (env ?? "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean),
  );
}

/** The language a bare approval is in. Egypt's WhatsApp is largely Arabic. */
function defaultTemplateLanguage(env: string | undefined = process.env.WHATSAPP_TEMPLATE_LANGUAGE): string {
  return env?.trim() || "ar";
}

export type TemplateStatus = "approved" | "not_approved" | "none";

/** Whether this kind can go by WhatsApp today, in any language. */
export function templateStatus(kind: string, approved = approvedTemplates()): TemplateStatus {
  const template = templateFor(kind);
  if (!template) return "none";
  return approvedLanguages(template.name, approved).length > 0 ? "approved" : "not_approved";
}

/** Every language one template name is approved in. */
function approvedLanguages(name: string, approved: Set<string>, fallback = defaultTemplateLanguage()): string[] {
  const out: string[] = [];
  for (const entry of approved) {
    const [entryName, language] = entry.split(":").map((part) => part.trim());
    if (entryName !== name) continue;
    const code = language || fallback;
    if (!out.includes(code)) out.push(code);
  }
  return out;
}

/**
 * 🔴 RULING 8: THE LANGUAGE CODE META IS ASKED FOR.
 *
 * The recipient's own language when the template is approved in it (`ar`
 * matches `ar` or `ar_EG`), otherwise the default language exactly as before,
 * so a template approved only in Arabic still reaches an English reader
 * rather than being refused. Null when it is not approved at all.
 */
export function templateLanguage(
  kind: string,
  locale: string | null | undefined,
  approved = approvedTemplates(),
  fallback = defaultTemplateLanguage(),
): string | null {
  const template = templateFor(kind);
  if (!template) return null;
  const languages = approvedLanguages(template.name, approved, fallback);
  if (languages.length === 0) return null;
  const own = locale
    ? languages.find((code) => code === locale || code.split("_")[0] === locale)
    : undefined;
  return own ?? (languages.includes(fallback) ? fallback : languages[0]!);
}

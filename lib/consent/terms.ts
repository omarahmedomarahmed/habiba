/**
 * The notice somebody agrees to when they create an account. Due diligence F3 and F11.
 *
 * ## Layered, and required
 *
 * The first layer is on the signup form itself: a short list of who processes the
 * data, in plain words, above a checkbox the form cannot be sent without. The second
 * layer is the full privacy notice and terms, linked from the same sentence. A person
 * who never opens the links has still been told the four facts that matter most: an
 * AI provider reads session audio, the video call runs through a third party, email
 * goes through a third party, and all of it is hosted in the United States.
 *
 * ## The version is stored, and it is a date
 *
 * `patient_accounts.terms_version` and `users.terms_version` hold the version string
 * below, and `terms_accepted_at` the instant. Changing who processes data, or where,
 * means changing the sentences in `lib/i18n/messages.ts` (`signupConsent.*`) AND
 * moving this version forward, so the rows already written keep pointing at what
 * those people actually read.
 *
 * ## The age gate is a confirmation, not a date of birth
 *
 * A date of birth asks for a piece of identifying data we have no other use for and
 * cannot check either. A confirmation is the lighter of the two and exactly as honest:
 * it records that the person said they are an adult, and when. Somebody who does not
 * tick it is refused with a message that points them to help that does not need an
 * account.
 */

/* DD-2 B1: moved forward when Recall.ai, WhatsApp and Paymob joined the list. */
export const TERMS_VERSION = "2026-10-02";

/**
 * Who processes the data, and for what. The source the copy is checked against
 * (`tests/due-diligence.test.ts` holds that each name appears in both languages).
 */
export const PROCESSORS = [
  { name: "OpenAI", purpose: "transcription, notes and the assistant", where: "United States" },
  { name: "Daily", purpose: "the video call", where: "United States" },
  { name: "Resend", purpose: "email", where: "United States" },
  { name: "Neon", purpose: "the database", where: "United States" },
  { name: "Vercel", purpose: "hosting", where: "United States" },
  /* DD-2 B1: three that process data and were missing from the notice. */
  { name: "Recall.ai", purpose: "the recorder in a Zoom, Meet or Teams session", where: "United States" },
  { name: "WhatsApp", purpose: "confirmations, reminders and codes, run by Meta", where: "Meta" },
  { name: "Paymob", purpose: "card and wallet payments in Egypt", where: "Egypt" },
] as const;

/** The lines of the signup notice, in order. Each processor above is named in one. */
export const SIGNUP_NOTICE_KEYS = [
  "signupConsent.openai",
  "signupConsent.daily",
  "signupConsent.recall",
  "signupConsent.resend",
  "signupConsent.whatsapp",
  "signupConsent.paymob",
  "signupConsent.hosting",
] as const;

export type SignupConsentProblem = "terms" | "adult" | null;

/**
 * Read the two boxes off a submitted form. Pure, so the rule is tested without a
 * browser: an unticked box sends nothing at all, and anything but "on" or "yes" is
 * treated as not ticked.
 */
export function signupConsentProblem(
  form: { get(name: string): unknown },
  opts: { needsAdult: boolean },
): SignupConsentProblem {
  const ticked = (name: string) => {
    const value = String(form.get(name) ?? "").trim().toLowerCase();
    return value === "on" || value === "yes" || value === "true";
  };
  if (opts.needsAdult && !ticked("adult")) return "adult";
  if (!ticked("terms")) return "terms";
  return null;
}

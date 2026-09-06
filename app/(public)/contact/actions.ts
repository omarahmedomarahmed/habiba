"use server";

import { fileTicket } from "@/lib/data/support";
import { getLocale } from "@/lib/i18n/server";
import type { Entity } from "@/lib/db/schema";

export type ContactState = {
  error?: string;
  /** 18R.8 — what happens next, and when. Never just "thanks". */
  ok?: { reference: string; hours: number };
};

/**
 * The public contact form. PLAN.md 18R.2–18R.5.
 *
 * A server action rather than an API route because there is nothing else to
 * be: no client is calling this but the form on the page, and an endpoint that
 * exists only for that is one more anonymous door to rate-limit.
 *
 * 🔴 Everything this receives is treated as clinical material — see
 * `lib/data/support.ts`. Nothing here logs it, emails it, or hands it to a
 * model, and this action does not so much as read the message back.
 */
export async function submitContact(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  /*
   * A honeypot, not a widget. 18R.5 is explicit that spam resistance must not
   * come from a third-party script watching the reader — the whole product is
   * built on people telling us things they would not want watched, and a
   * tracker on the page they use to ask for help contradicts that on the page
   * where it matters most. A hidden field a human never sees and a bot fills
   * in costs nothing and stops the unsophisticated majority; the rate limits
   * in `fileTicket` stop the rest.
   */
  if (String(formData.get("website") ?? "").trim() !== "") {
    // Answered as though it worked. Telling a bot it was caught teaches it.
    return { ok: { reference: "RECEIVED", hours: 24 } };
  }

  const locale = await getLocale().catch(() => "en" as const);

  const result = await fileTicket({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? "") || null,
    phone: String(formData.get("phone") ?? "") || null,
    country: String(formData.get("country") ?? "") || null,
    topic: String(formData.get("topic") ?? ""),
    message: String(formData.get("message") ?? ""),
    locale,
    entity: (String(formData.get("entity") ?? "us") === "eg" ? "eg" : "us") as Entity,
    source: "contact_form",
  });

  if (!result.ok) return { error: result.error };

  return {
    ok: {
      reference: result.reference,
      hours: Math.max(1, Math.round((result.dueAt.getTime() - Date.now()) / 3_600_000)),
    },
  };
}

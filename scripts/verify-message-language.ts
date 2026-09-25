/**
 * 🔴 RULING 8: EVERY MESSAGE WE SEND SOMEBODY IS IN THE LANGUAGE THEY CHOSE.
 *
 *   npm run verify:message-language
 *
 * Proves, against the dev database, with the real senders:
 *   - a patient whose `people.locale` is `ar` gets an Arabic subject and body,
 *     laid out right to left, for a session starting, a clinician cancelling,
 *     a payment confirmed and a history grant;
 *   - a patient with no saved choice gets the same four in English;
 *   - the words are the dictionary's, read through `stringsFor`, so an admin
 *     override would apply;
 *   - WhatsApp asks Meta for the Arabic template for one and the English for the
 *     other when both are approved, and keeps the old fallback (the default
 *     language) when only that one is.
 *
 * No provider is configured on dev, so nothing leaves: a fake key switches the
 * email channel on and every request to Resend and to Meta is caught here and
 * read, never sent. Fixtures use example.com and are removed at the end.
 */
import { sql } from "drizzle-orm";

import { reporter, writesTo } from "./_verify";
import { connect } from "./db";

const { check, finish } = reporter();
const fixture = `mlang${Date.now().toString(36)}`;
const HOUR = 3_600_000;
const ARABIC = /[؀-ۿ]/;

type Mail = { to: string; subject: string; html: string };
type Chat = { to: string; language: string; template: string };

async function main() {
  writesTo();

  /*
   * 🔴 BEFORE ANY `lib` MODULE LOADS. `lib/env` reads the key once, at import,
   * and a key set afterwards would leave the email channel off and prove
   * nothing. These values reach no provider: the fetch below answers for them.
   */
  const saved = {
    resend: process.env.RESEND_API_KEY,
    token: process.env.WHATSAPP_TOKEN,
    phoneId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    approved: process.env.WHATSAPP_APPROVED_TEMPLATES,
    language: process.env.WHATSAPP_TEMPLATE_LANGUAGE,
  };
  process.env.RESEND_API_KEY = "re_verify_message_language_not_a_key";
  process.env.WHATSAPP_TOKEN = "unused-in-this-check";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "0";
  process.env.WHATSAPP_APPROVED_TEMPLATES = "session_started,session_started:en";
  process.env.WHATSAPP_TEMPLATE_LANGUAGE = "ar";

  const mails: Mail[] = [];
  const chats: Chat[] = [];
  let leaked = false;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const body = typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    if (url.includes("api.resend.com")) {
      const to = Array.isArray(body.to) ? String(body.to[0]) : String(body.to ?? "");
      mails.push({ to, subject: String(body.subject ?? ""), html: String(body.html ?? "") });
      return new Response(JSON.stringify({ id: "verify" }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("graph.facebook.com")) {
      const template = (body.template ?? {}) as { name?: string; language?: { code?: string } };
      chats.push({ to: String(body.to ?? ""), language: template.language?.code ?? "", template: template.name ?? "" });
      return new Response(JSON.stringify({ messages: [{ id: "verify" }] }), { status: 200 });
    }
    if (/resend|facebook|twilio/.test(url)) leaked = true;
    return realFetch(input, init);
  }) as typeof fetch;

  const { db, pool } = connect();
  const rows = async <T,>(text: ReturnType<typeof sql>): Promise<T[]> => (await db.execute(text)).rows as T[];
  const one = async <T,>(text: ReturnType<typeof sql>): Promise<T> => (await rows<T>(text))[0] as T;
  const startedAt = new Date();

  /* ------------------------------------------------------------ pure -- */
  const { templateLanguage } = await import("../lib/notify/templates");
  check(
    "WhatsApp: the recipient's language when Meta approved it, the default language when only that is",
    templateLanguage("session.started", "en", new Set(["session_started", "session_started:en"]), "ar") === "en" &&
      templateLanguage("session.started", "ar", new Set(["session_started", "session_started:en"]), "ar") === "ar" &&
      templateLanguage("session.started", "en", new Set(["session_started"]), "ar") === "ar" &&
      templateLanguage("session.started", "ar", new Set(["session_started:ar_EG"]), "ar") === "ar_EG" &&
      templateLanguage("session.started", "en", new Set(), "ar") === null,
  );

  let orgId: string | null = null;
  const personIds: string[] = [];
  try {
    const org = await one<{ id: string }>(sql`
      INSERT INTO organizations (name, region, slug) VALUES ('Message Language Demo', 'eg', ${fixture}) RETURNING id`);
    orgId = org.id;
    const therapist = await one<{ id: string }>(sql`
      INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash, session_rate_cents, timezone)
      VALUES (${org.id}, ${`salma.${fixture}@example.com`}, 'Salma', 'Demo', 'therapist', 'x', 2000, 'Africa/Cairo') RETURNING id`);
    await db.execute(sql`
      INSERT INTO therapist_verifications (user_id, organization_id, state, country, license_body, license_number,
        specialties, languages, submitted_at)
      VALUES (${therapist.id}, ${org.id}, 'approved', 'EG', 'Fixture board', 'X1', '["anxiety"]'::jsonb, '["en"]'::jsonb, now())`);

    const base = Math.ceil(Date.now() / HOUR) * HOUR;
    let slotHour = 72;
    const { bookSlot } = await import("../lib/data/scheduling");

    /** One patient, with a record, an account, a phone, and two booked sessions. */
    const patient = async (first: string, locale: string | null, phone: string) => {
      const email = `${first.toLowerCase()}.${fixture}@example.com`;
      const p = await one<{ id: string }>(sql`
        INSERT INTO people (first_name, last_name, email, phone, region, locale)
        VALUES (${first}, 'Demo', ${email}, ${phone}, 'eg', ${locale}) RETURNING id`);
      personIds.push(p.id);
      const chart = await one<{ id: string }>(sql`
        INSERT INTO patients (organization_id, therapist_id, person_id, first_name, last_name, email, phone, timezone, source)
        VALUES (${org.id}, ${therapist.id}, ${p.id}, ${first}, 'Demo', ${email}, ${phone}, 'Africa/Cairo', 'self')
        RETURNING id`);
      const account = await one<{ id: string }>(sql`
        INSERT INTO patient_accounts (person_id, email, phone, timezone)
        VALUES (${p.id}, ${email}, ${phone}, 'Africa/Cairo') RETURNING id`);
      const book = async () => {
        slotHour += 2;
        const slot = await one<{ id: string }>(sql`
          INSERT INTO availability_slots (therapist_user_id, organization_id, starts_at, status)
          VALUES (${therapist.id}, ${org.id}, ${new Date(base + slotHour * HOUR)}, 'open') RETURNING id`);
        const booked = await bookSlot({ slotId: slot.id, patientId: chart.id, bookedBy: therapist.id, patientName: first });
        if (!booked.ok) throw new Error(booked.error);
        return booked.sessionId;
      };
      return { personId: p.id, accountId: account.id, email, phone, started: await book(), cancelled: await book() };
    };

    const laila = await patient("Laila", "ar", "+201001110001");
    const omar = await patient("Omar", null, "+201001110002");

    /* ------------------------------------------------- the real senders -- */
    const { noticeSessionStarted } = await import("../lib/sessions/started-notice");
    const { afterClinicianCancel } = await import("../lib/data/clinician-cancel");
    const { notifyPatientOfGrant } = await import("../lib/data/portability");
    const { noticePaymentConfirmed } = await import("../lib/billing/payment-notices");

    const send = async (who: typeof laila) => {
      const before = mails.length;
      await noticeSessionStarted(who.started);
      const started = mails.slice(before).find((m) => m.to === who.email);

      const mark = mails.length;
      await afterClinicianCancel({ actorUserId: therapist.id, sessionId: who.cancelled, reason: "Fixture reason" });
      const cancelled = mails.slice(mark).find((m) => m.to === who.email);

      const paidMark = mails.length;
      const payment = await one<{ id: string }>(sql`
        INSERT INTO manual_payments (purpose, ref_id, amount_cents, currency, settles_cents, payer_kind,
          patient_account_id, organization_id, state, decided_at)
        VALUES ('session', ${who.started}, 2000, 'USD', 2000, 'patient', ${who.accountId}, ${org.id}, 'confirmed', now())
        RETURNING id`);
      await noticePaymentConfirmed(payment.id);
      const paid = mails.slice(paidMark).find((m) => m.to === who.email);

      const grantMark = mails.length;
      await notifyPatientOfGrant({ personId: who.personId, therapistUserId: therapist.id });
      const granted = mails.slice(grantMark).find((m) => m.to === who.email);

      return { started, cancelled, paid, granted };
    };

    const ar = await send(laila);
    const en = await send(omar);

    /* The expected words, through the same resolver the senders use. */
    const { stringsFor } = await import("../lib/i18n/strings");
    const tAr = (await stringsFor("ar")).t;
    const tEn = (await stringsFor("en")).t;

    const cases = [
      { name: "session started", key: "pmsg.started.subject" as const, got: [ar.started, en.started] },
      { name: "booking cancelled by the clinician", key: "w1a.noShowCancelled" as const, got: [ar.cancelled, en.cancelled] },
      { name: "payment confirmed", key: "pmsg.pay.sessionPaidSubject" as const, got: [ar.paid, en.paid] },
      { name: "history grant", key: "pmsg.granted.subject" as const, got: [ar.granted, en.granted] },
    ];

    /** The visible text of an email body, tags and entities out. */
    const text = (html: string) =>
      html
        .replace(/<title>[\s\S]*?<\/title>/, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&[a-z#0-9]+;/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    /*
     * 🔴 CONTROL: the detector can say both words. An English subject must fail
     * the Arabic test and an Arabic one must pass it, or every check below
     * would pass for any text at all.
     */
    check(
      "🔴 CONTROL the Arabic test rejects the English subject and accepts the Arabic one",
      cases.every((c) => ARABIC.test(tAr(c.key)) && !ARABIC.test(tEn(c.key)) && tAr(c.key) !== tEn(c.key)),
    );

    for (const c of cases) {
      const [arabic, english] = c.got;
      check(
        `🔴 ${c.name}: Laila chose Arabic, and the subject and body are Arabic, right to left`,
        Boolean(arabic) &&
          arabic!.subject === tAr(c.key) &&
          ARABIC.test(arabic!.subject) &&
          ARABIC.test(text(arabic!.html)) &&
          /dir="rtl"/.test(arabic!.html) &&
          !/Hi |Your session|If you were not expecting/.test(text(arabic!.html)),
        arabic ? `"${arabic.subject}"` : "no email captured",
      );
      check(
        `🔴 ${c.name}: Omar chose nothing, and gets English`,
        Boolean(english) &&
          english!.subject === tEn(c.key) &&
          !ARABIC.test(english!.subject) &&
          !ARABIC.test(text(english!.html)) &&
          !/dir="rtl"/.test(english!.html),
        english ? `"${english.subject}"` : "no email captured",
      );
    }

    /* ------------------------------------------------------- WhatsApp -- */
    const lailaChat = chats.find((c) => c.to === laila.phone.slice(1) && c.template === "session_started");
    const omarChat = chats.find((c) => c.to === omar.phone.slice(1) && c.template === "session_started");
    check(
      "🔴 WhatsApp: the session-started template is asked for in Arabic for Laila and in English for Omar",
      lailaChat?.language === "ar" && omarChat?.language === "en",
      JSON.stringify({ laila: lailaChat?.language, omar: omarChat?.language }),
    );

    /* -------------------------------------------------------- in the app -- */
    const notices = await rows<{ person_id: string; message_key: string }>(sql`
      SELECT person_id, message_key FROM patient_notifications WHERE person_id IN (${laila.personId}, ${omar.personId})`);
    const keysFor = (id: string) => notices.filter((n) => n.person_id === id).map((n) => n.message_key);
    check(
      "the same messages are in each patient's app, as keys read in their own language",
      ["pnotice.sessionStarted", "pnotice.paymentConfirmed", "pnotice.accessGranted"].every(
        (key) => keysFor(laila.personId).includes(key) && keysFor(omar.personId).includes(key),
      ) && ARABIC.test(tAr("pnotice.accessGranted")),
      `${keysFor(laila.personId).length} and ${keysFor(omar.personId).length}`,
    );

    check("nothing reached a real provider", !leaked);
  } finally {
    globalThis.fetch = realFetch;
    for (const [name, value] of [
      ["RESEND_API_KEY", saved.resend],
      ["WHATSAPP_TOKEN", saved.token],
      ["WHATSAPP_PHONE_NUMBER_ID", saved.phoneId],
      ["WHATSAPP_APPROVED_TEMPLATES", saved.approved],
      ["WHATSAPP_TEMPLATE_LANGUAGE", saved.language],
    ] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    if (orgId) {
      await db.execute(sql`DELETE FROM refund_requests WHERE organization_id = ${orgId}`);
      await db.execute(sql`DELETE FROM ledger_entries WHERE organization_id = ${orgId}`);
      await db.execute(sql`DELETE FROM manual_payments WHERE organization_id = ${orgId}`);
      await db.execute(sql`DELETE FROM session_payments WHERE organization_id = ${orgId}`);
      await db.execute(sql`DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE organization_id = ${orgId})`);
      await db.execute(sql`DELETE FROM audit_log WHERE organization_id = ${orgId}`);
      await db.execute(sql`DELETE FROM availability_slots WHERE organization_id = ${orgId}`);
      await db.execute(sql`DELETE FROM sessions WHERE organization_id = ${orgId}`);
      /*
       * The delivery log names no recipient, so this run's rows are found by
       * their kind and their time: every send above, and nothing older.
       */
      await db.execute(sql`
        DELETE FROM delivery_attempts
        WHERE created_at >= ${startedAt}
          AND (organization_id = ${orgId} OR organization_id IS NULL)
          AND kind IN ('session.started', 'booking.cancelled', 'payment.confirmed', 'consent.granted')`);
    }
    for (const id of personIds) {
      await db.execute(sql`DELETE FROM patient_notifications WHERE person_id = ${id}`);
      await db.execute(sql`DELETE FROM patient_accounts WHERE person_id = ${id}`);
    }
    if (orgId) {
      await db.execute(sql`DELETE FROM patients WHERE organization_id = ${orgId}`);
      await db.execute(sql`DELETE FROM therapist_verifications WHERE organization_id = ${orgId}`);
      await db.execute(sql`DELETE FROM users WHERE organization_id = ${orgId}`);
    }
    for (const id of personIds) await db.execute(sql`DELETE FROM people WHERE id = ${id}`);
    if (orgId) await db.execute(sql`DELETE FROM organizations WHERE id = ${orgId}`);
    await pool.end();
  }

  finish("message language");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

/**
 * 🔴 WAVE 2, PARTNER: EVERY DEAD END GETS A WAY FORWARD.
 *
 *   npm run verify:w2x
 *
 * One section per item in `takeover/FIX-PLAN.md` (W2-X01 to W2-X06), each
 * written to fail on the code as it was before the fix and planted against
 * real rows, because each one is a property of what the database keeps.
 *
 * Everything it makes is deleted in a `finally`, and `writesTo()` refuses
 * production by name.
 */
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

import { sql } from "drizzle-orm";

import { startMockOpenAi } from "../tests/mock-openai";
import { readSource, reporter, writesTo } from "./_verify";
import { connect } from "./db";

const { check, finish, skipUnless } = reporter();

const fixture = `w2x${Date.now().toString(36)}`;

/** A uuid nobody holds, for the borrowed-id checks. */
const randomUuid = () => crypto.randomUUID();

/** A WAV of silence: 16 kHz, mono, 16-bit, so one second is 32,000 bytes. */
function silentWav(seconds: number): Buffer {
  const data = 32_000 * seconds;
  const out = Buffer.alloc(44 + data);
  out.write("RIFF", 0);
  out.writeUInt32LE(36 + data, 4);
  out.write("WAVE", 8);
  out.write("fmt ", 12);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(16_000, 24);
  out.writeUInt32LE(32_000, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(data, 40);
  return out;
}

async function main() {
  writesTo();

  /* The partner routes transcribe, so they talk to the e2e stand-in. */
  const mock = startMockOpenAi(4321);
  process.env.OPENAI_BASE_URL = "http://127.0.0.1:4321/v1";
  process.env.OPENAI_API_KEY ||= "sk-mock";
  /* Webhook secrets are sealed, and a developer's .env.local may have no key. */
  process.env.TOKEN_ENCRYPTION_KEY ||= randomBytes(32).toString("base64");

  /*
   * 🔴 THE PARTNER'S ENDPOINT, STANDING IN FOR THE INTERNET. Webhooks are sent with
   * the global fetch, so the fixture's own host answers from here with whatever
   * status the check sets, and records what it was sent. Every other URL goes out
   * as it would from the cron.
   */
  const hookHost = `https://hooks.${fixture}.example.com`;
  const endpoint = { status: 500, calls: [] as { delivery: string | null; body: string }[] };
  /*
   * And the mail provider: a key so the product sends, and every send caught here
   * rather than leaving the machine, so a password link can be read back.
   */
  process.env.RESEND_API_KEY = "re_verify_w2x";
  const mail: { to: string; html: string }[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith("https://api.resend.com")) {
      const sent = JSON.parse(String(init?.body ?? "{}")) as { to?: string | string[]; html?: string };
      mail.push({ to: [sent.to].flat().join(","), html: sent.html ?? "" });
      return Response.json({ id: "caught" });
    }
    if (!url.startsWith(hookHost)) return realFetch(input, init);
    const headers = new Headers(init?.headers);
    endpoint.calls.push({ delivery: headers.get("x-24t-delivery"), body: String(init?.body) });
    return new Response(null, { status: endpoint.status });
  }) as typeof fetch;

  const { db, pool } = connect();

  const one = async <T>(text: ReturnType<typeof sql>): Promise<T> => {
    const { rows } = await db.execute(text);
    return rows[0] as T;
  };

  /* The limiter rows this plants, removed by name in the `finally`. */
  const buckets: string[] = [];

  try {
    const partner = await one<{ id: string }>(sql`
      INSERT INTO partners (name, slug, state, contact_email)
      VALUES (${fixture}, ${fixture}, 'active', ${`ops.${fixture}@example.com`})
      RETURNING id`);
    const { mintKey } = await import("../lib/partner/keys");
    const minted = await mintKey({
      partnerId: partner.id,
      label: "wave 2 partner",
      environment: "sandbox",
      sponsorId: null,
      scopes: ["consent:write", "session:media", "transcript:read", "note:review",
        "copilot:chat", "memory:read"],
    });
    const keyId = minted.key!.id;
    const bearer = { authorization: `Bearer ${minted.key?.raw}` };
    const base = "http://localhost/api/partner/v1";
    const consentRoute = await import("../app/api/partner/v1/consent/route");
    const history = (session: string) =>
      consentRoute.GET(new Request(`${base}/consent?session=${session}`, { headers: bearer }));

    /* ================================================================ */
    /*  W2-X01 · A BURST IS THROTTLED, NEVER A PERMANENT SUSPENSION      */
    /* ================================================================ */

    /*
     * The minute's budget is planted as spent rather than burned with sixty
     * calls: the limiter's own row, at the limit, in the current window.
     */
    const { subjectKey } = await import("../lib/rate-limit");
    const bucket = subjectKey("api-key", keyId);
    buckets.push(bucket);
    await db.execute(sql`
      INSERT INTO rate_limits (key, count, window_start, expires_at)
      VALUES (${bucket}, 60, now(), now() + interval '60 seconds')
      ON CONFLICT (key) DO UPDATE SET count = 60, window_start = now()`);

    const burst = await history(`${fixture}-rate`);
    const retryAfter = Number(burst.headers.get("retry-after"));
    check(
      "🔴 W2-X01 the call past the limit is a 429 that says when to come back",
      burst.status === 429 && retryAfter >= 1 && retryAfter <= 60,
      `status ${burst.status}, Retry-After ${burst.headers.get("retry-after")}`,
    );

    const afterBurst = await one<{ suspended: string | null }>(sql`
      SELECT suspended_at AS suspended FROM partner_api_keys WHERE id = ${keyId}`);
    check(
      "🔴 W2-X01 …and the key is not suspended",
      afterBurst.suspended === null,
      `suspended_at ${afterBurst.suspended}`,
    );

    /* The window rolls over: the limiter's row goes, as it does after a minute. */
    await db.execute(sql`DELETE FROM rate_limits WHERE key = ${bucket}`);
    const recovered = await history(`${fixture}-rate`);
    check(
      "🔴 W2-X01 CONTROL once the caller slows down, the same key answers again, so the 429 above is the limit and not a broken key",
      recovered.status === 200,
      `status ${recovered.status}`,
    );

    /* ================================================================ */
    /*  W2-X02 · AN END-SESSION CALL, SO COPILOT AND MEMORY HAVE MATERIAL */
    /* ================================================================ */

    const mediaRoute = await import("../app/api/partner/v1/sessions/[ref]/media/route");
    const memoryRoute = await import("../app/api/partner/v1/subjects/[ref]/memory/route");
    const copilotRoute = await import("../app/api/partner/v1/copilot/route");
    const endRoute = await import("../app/api/partner/v1/sessions/[ref]/end/route").catch(
      () => null,
    );
    const consent = (session: string, subject: string) =>
      consentRoute.POST(
        new Request(`${base}/consent`, {
          method: "POST",
          headers: { ...bearer, "content-type": "application/json" },
          body: JSON.stringify({
            session,
            subject,
            state: "given",
            answered_at: new Date().toISOString(),
            offset_seconds: 0,
          }),
        }),
      );
    const media = (ref: string) =>
      mediaRoute.POST(
        new Request(`${base}/sessions/${ref}/media`, {
          method: "POST",
          headers: { ...bearer, "content-type": "audio/wav" },
          body: silentWav(1),
        }),
        { params: Promise.resolve({ ref }) },
      );
    const end = async (ref: string) =>
      endRoute
        ? endRoute.POST(new Request(`${base}/sessions/${ref}/end`, { method: "POST", headers: bearer }), {
            params: Promise.resolve({ ref }),
          })
        : null;
    const remember = async (subject: string) => {
      const response = await memoryRoute.GET(
        new Request(`${base}/subjects/${subject}/memory`, { headers: bearer }),
        { params: Promise.resolve({ ref: subject }) },
      );
      return ((await response.json()) as { sessions?: unknown[] }).sessions?.length ?? 0;
    };

    const ended = `${fixture}-e1`;
    const endedSubject = `${fixture}-P1`;
    await consent(ended, endedSubject);
    const heard = await media(ended);
    const beforeEnd = await remember(endedSubject);
    const endResponse = await end(ended);
    const endBody = endResponse
      ? ((await endResponse.json()) as { ended_at?: string })
      : {};
    const afterEnd = await remember(endedSubject);
    check(
      "🔴 W2-X02 ending a session makes it material: memory had none while it ran, one after",
      heard.status === 200 && beforeEnd === 0 && endResponse?.status === 200 &&
        Boolean(endBody.ended_at) && afterEnd === 1,
      `media ${heard.status}, before ${beforeEnd}, end ${endResponse?.status ?? "no route"}, after ${afterEnd}`,
    );

    const { enableClinician } = await import("../lib/partner/platform");
    await enableClinician({ partnerId: partner.id, externalClinicianRef: `${fixture}-C1`, enabled: true });
    const asked = await copilotRoute.POST(
      new Request(`${base}/copilot`, {
        method: "POST",
        headers: { ...bearer, "content-type": "application/json" },
        body: JSON.stringify({
          subject: endedSubject,
          clinician: `${fixture}-C1`,
          question: "What did we cover?",
        }),
      }),
    );
    const answer = ((await asked.json()) as { answer?: string }).answer ?? "";
    check(
      "🔴 W2-X02 …and the copilot answers from it, rather than 'no completed sessions'",
      asked.status === 200 && answer.length > 0 && !/no completed sessions/i.test(answer),
      answer.slice(0, 80),
    );

    const again = await end(ended);
    const againBody = again ? ((await again.json()) as { ended_at?: string }) : {};
    const lateAudio = await media(ended);
    check(
      "W2-X02 ending twice keeps the first time, and audio after the end is refused",
      againBody.ended_at === endBody.ended_at && lateAudio.status === 409,
      `${againBody.ended_at} vs ${endBody.ended_at}, late audio ${lateAudio.status}`,
    );

    const nobody = await end(`${fixture}-none`);
    check("W2-X02 an unknown session is a 404", nobody?.status === 404, `${nobody?.status}`);

    /* ================================================================ */
    /*  W2-X04 · ROTATE, CONFIRM ON REVOKE, AUDIT ON MINT AND REVOKE     */
    /* ================================================================ */

    const keys = await import("../lib/partner/keys");
    const actorId = randomUuid();
    const audited = async (action: string, keyId: string) =>
      (
        await one<{ n: number }>(sql`
          SELECT count(*)::int AS n FROM audit_log
           WHERE action = ${action} AND resource_id = ${keyId}`)
      ).n;

    const rollable = await keys.mintKey({
      partnerId: partner.id,
      label: "to be rolled",
      environment: "sandbox",
      sponsorId: null,
      scopes: ["consent:write"],
      byPartnerUserId: actorId,
    } as Parameters<typeof keys.mintKey>[0]);
    const oldId = rollable.key!.id;
    check(
      "🔴 W2-X04 minting a key writes an audit row",
      (await audited("partner.key.mint", oldId)) === 1,
      `${await audited("partner.key.mint", oldId)} rows`,
    );

    const asKey = (raw: string) => (session: string) =>
      consentRoute.GET(
        new Request(`${base}/consent?session=${session}`, { headers: { authorization: `Bearer ${raw}` } }),
      );
    const oldCall = asKey(rollable.key!.raw);

    const rotateKey = (keys as { rotateKey?: typeof keys.rotateKey }).rotateKey;
    const rolled = rotateKey
      ? await rotateKey({ partnerId: partner.id, keyId: oldId, overlapHours: 24, byPartnerUserId: actorId })
      : { error: "no rotateKey" };
    const newKey = rolled.key;
    const oldEnd = await one<{ hours: number | null }>(sql`
      SELECT EXTRACT(EPOCH FROM revoked_at - now()) / 3600 AS hours
        FROM partner_api_keys WHERE id = ${oldId}`);
    const oldDuring = (await oldCall(`${fixture}-roll`)).status;
    const newDuring = newKey ? (await asKey(newKey.raw)(`${fixture}-roll`)).status : 0;
    check(
      "🔴 W2-X04 rotating mints a replacement, and the old key keeps working through the overlap",
      Boolean(newKey) && newDuring === 200 && oldDuring === 200 &&
        Number(oldEnd.hours) > 23.5 && Number(oldEnd.hours) < 24.5,
      `${rolled.error ?? "rolled"}, old ${oldDuring}, new ${newDuring}, old ends in ${Number(oldEnd.hours).toFixed(2)} h`,
    );
    check(
      "W2-X04 …and the roll is audited",
      (await audited("partner.key.rotate", oldId)) === 1 &&
        (newKey ? await audited("partner.key.mint", newKey.id) : 0) === 1,
      `rotate ${await audited("partner.key.rotate", oldId)}`,
    );

    await db.execute(sql`
      UPDATE partner_api_keys SET revoked_at = now() - interval '1 second' WHERE id = ${oldId}`);
    const oldAfter = (await oldCall(`${fixture}-roll`)).status;
    const rollAgain = rotateKey
      ? await rotateKey({ partnerId: partner.id, keyId: oldId, overlapHours: 24 })
      : { error: "no rotateKey" };
    check(
      "🔴 W2-X04 once the overlap is over the old key is refused, and it cannot be rolled again",
      oldAfter === 401 && Boolean(rollAgain.error),
      `old ${oldAfter}, second roll: ${rollAgain.error ?? "allowed"}`,
    );

    if (newKey) {
      const borrowed = await keys.revokeKey(randomUuid(), newKey.id, actorId);
      await keys.revokeKey(partner.id, newKey.id, actorId);
      const newAfter = (await asKey(newKey.raw)(`${fixture}-roll`)).status;
      check(
        "🔴 W2-X04 revoking stops the key at once and writes an audit row; a borrowed id revokes nothing",
        newAfter === 401 && (await audited("partner.key.revoke", newKey.id)) === 1 &&
          (borrowed as { ok?: boolean }).ok !== true,
        `after revoke ${newAfter}, audit ${await audited("partner.key.revoke", newKey.id)}`,
      );
    } else {
      check("🔴 W2-X04 revoking stops the key at once and writes an audit row", false, "no key to revoke");
    }

    const keyList = readSource("components/partner/key-list.tsx");
    check(
      "🔴 W2-X04 Revoke asks first: the form that revokes is only on the confirm step, beside a Cancel",
      /asking\.act === "revoke"/.test(keyList) && /dev\.revokeConfirm/.test(keyList) &&
        /dev\.cancel/.test(keyList) &&
        keyList.indexOf("action={revoke}") > keyList.indexOf('asking.act === "revoke"'),
      "a one-tap revoke stops a production integration with no question asked",
    );
    /* 🔴 …and so does disabling a webhook endpoint, which was one tap that stopped every delivery. */
    const hookList = readSource("components/partner/webhook-list.tsx");
    check(
      "🔴 Disable on a webhook asks first: the form that disables is only on the confirm step, beside a Cancel",
      /asking === hook\.id \?/.test(hookList) && /dev\.disableConfirm/.test(hookList) && /dev\.cancel/.test(hookList) &&
        hookList.indexOf("action={disable}") > hookList.indexOf("asking === hook.id ?"),
      "a one-tap disable stops a production endpoint with no question asked",
    );

    /*
     * 🔴 K13: PRODUCTION APPROVAL NEEDS THEIR DOCUMENTS, AND NOW SOMETHING RECORDS THEM.
     *
     * `approveForProduction` refused without `documents_url` and nothing in
     * the product wrote it, so no partner could be approved without SQL. The
     * owner records an https link on /admin/partners; approval then goes, and
     * the link is fixed while the approval stands.
     */
    {
      const admin = await import("../lib/data/partner-admin");
      const docsPartner = await one<{ id: string }>(sql`
        INSERT INTO partners (name, slug, state, contact_name, contact_email, contact_phone)
        VALUES (${`${fixture}-docs`}, ${`${fixture}-docs`}, 'active', 'Docs Demo', ${`docs.${fixture}@example.com`}, '+201000000001')
        RETURNING id`);
      const approver = await one<{ id: string }>(sql`SELECT id FROM users WHERE role = 'super_admin' LIMIT 1`);
      const before = await admin.approveForProduction({ partnerId: docsPartner.id, byUserId: approver.id });
      const plainHttp = await admin.setPartnerDocuments({ partnerId: docsPartner.id, documentsUrl: "http://example.com/docs" });
      const recorded = await admin.setPartnerDocuments({ partnerId: docsPartner.id, documentsUrl: "https://example.com/docs/demo" });
      const approved = await admin.approveForProduction({ partnerId: docsPartner.id, byUserId: approver.id });
      const afterApproval = await admin.setPartnerDocuments({ partnerId: docsPartner.id, documentsUrl: "https://example.com/other" });
      const row = await one<{ documents_url: string | null; approved: boolean }>(sql`
        SELECT documents_url, approved_at IS NOT NULL AS approved FROM partners WHERE id = ${docsPartner.id}`);
      check(
        "🔴 K13 the owner records the documents link, and only then can the partner be approved for production",
        Boolean(before.error) && plainHttp.error === "apartner.errDocsUrl" && recorded.ok === true &&
          approved.ok === true && row.approved,
        JSON.stringify({ before, plainHttp, recorded, approved }),
      );
      check(
        "K13 …and the link the approval rests on cannot be swapped while it stands",
        afterApproval.error === "apartner.errDocsApproved" && row.documents_url === "https://example.com/docs/demo",
        JSON.stringify({ afterApproval, url: row.documents_url }),
      );
      check(
        "K13 …and the console has the form that writes it",
        /saveDocuments/.test(readSource("components/admin/partner-manager.tsx")) &&
          /export async function saveDocuments[\s\S]*?requireRole\("super_admin"\)[\s\S]*?setPartnerDocuments\(/.test(
            readSource("app/(admin)/admin/partners/actions.ts"),
          ),
      );
    }

    /* ================================================================ */
    /*  W2-X05 · BILLED AT FIRST AUDIO; ALERTS RESET MONTHLY, ABSOLUTE   */
    /* ================================================================ */

    /*
     * A live key, planted as a row: minting one needs a production approval, which
     * needs a named approver, and neither is what this checks.
     */
    const liveRaw = `24t_sk_live_${randomBytes(24).toString("base64url")}`;
    await db.execute(sql`
      INSERT INTO partner_api_keys (partner_id, label, key_hash, prefix, scopes, environment)
      VALUES (${partner.id}, 'live fixture', ${createHash("sha256").update(liveRaw).digest("hex")},
              ${liveRaw.slice(0, 18)}, ${JSON.stringify(["consent:write", "session:media"])}::jsonb, 'live')`);
    const live = { authorization: `Bearer ${liveRaw}` };
    const liveConsent = (session: string) =>
      consentRoute.POST(
        new Request(`${base}/consent`, {
          method: "POST",
          headers: { ...live, "content-type": "application/json" },
          body: JSON.stringify({
            session,
            subject: `${fixture}-L`,
            state: "given",
            answered_at: new Date().toISOString(),
            offset_seconds: 0,
          }),
        }),
      );
    const liveMedia = (ref: string) =>
      mediaRoute.POST(
        new Request(`${base}/sessions/${ref}/media`, {
          method: "POST",
          headers: { ...live, "content-type": "audio/wav" },
          body: silentWav(1),
        }),
        { params: Promise.resolve({ ref }) },
      );
    const usage = await import("../lib/partner/usage");
    const used = async () => (await usage.usageFor(partner.id)).used;

    await usage.setLimit({ partnerId: partner.id, monthlySessionLimit: 2 });
    await liveConsent(`${fixture}-L1`);
    const afterConsent = await used();
    check(
      "🔴 W2-X05 a consent on its own bills nothing: no audio, no session on the bill",
      afterConsent === 0,
      `${afterConsent} billed after a consent with no audio`,
    );

    const firstAudio = await liveMedia(`${fixture}-L1`);
    const afterFirst = await used();
    await liveMedia(`${fixture}-L1`);
    const afterSecond = await used();
    check(
      "🔴 W2-X05 the first audio bills the session, once: a second piece adds nothing",
      firstAudio.status === 200 && afterFirst === 1 && afterSecond === 1,
      `media ${firstAudio.status}, ${afterFirst} then ${afterSecond}`,
    );

    await liveConsent(`${fixture}-L2`);
    await liveConsent(`${fixture}-L3`);
    await liveMedia(`${fixture}-L2`);
    const heardBefore = mock.state.transcriptionRequests.length;
    const overLimit = await liveMedia(`${fixture}-L3`);
    const overBody = (await overLimit.json()) as { error?: string };
    check(
      "🔴 W2-X05 a session opened under the limit is stopped at its first audio if the month is full, untranscribed",
      overLimit.status === 409 && /limit it set/.test(overBody.error ?? "") && (await used()) === 2 &&
        mock.state.transcriptionRequests.length === heardBefore,
      `status ${overLimit.status}, ${await used()} billed, ${mock.state.transcriptionRequests.length - heardBefore} transcribed`,
    );

    /* The alert stamps, as a month that crossed 80% and 90% left them. */
    await db.execute(sql`
      UPDATE partner_limits
         SET monthly_session_limit = 2,
             alerted_80_at = date_trunc('month', now() AT TIME ZONE 'UTC') - interval '10 days',
             alerted_90_at = date_trunc('month', now() AT TIME ZONE 'UTC') - interval '5 days',
             period_start = date_trunc('month', now() AT TIME ZONE 'UTC') - interval '1 month'
       WHERE partner_id = ${partner.id}`);
    await usage.alertApproachingLimits();
    const stamps = await one<{ fresh: boolean }>(sql`
      SELECT alerted_90_at >= date_trunc('month', now() AT TIME ZONE 'UTC') AS fresh
        FROM partner_limits WHERE partner_id = ${partner.id}`);
    check(
      "🔴 W2-X05 last month's alert stamps do not silence this month: the 90% alert is sent again",
      stamps.fresh === true,
      `fresh ${stamps.fresh}`,
    );
    check(
      "W2-X05 …and the alert's link is absolute, so it opens from an email",
      /url: `\$\{env\.appUrl\}\/partner\/usage`/.test(readSource("lib/partner/usage.ts")),
      "a relative link in an email has no host",
    );

    /* ================================================================ */
    /*  W2-X06 · PASSWORD RESET, COLLEAGUES, SIGN-IN LINKED              */
    /* ================================================================ */

    const team = await import("../lib/partner/team").catch(() => null);
    const { hashPassword } = await import("../lib/auth/password");
    const { checkPartnerPassword } = await import("../lib/data/partner-admin");
    const admin = await one<{ id: string }>(sql`
      INSERT INTO partner_users (partner_id, email, name, password_hash, role)
      VALUES (${partner.id}, ${`admin.${fixture}@example.com`}, 'Mona Admin',
              ${await hashPassword("the-first-password-1")}, 'admin')
      RETURNING id`);
    /* 🔴 0170: mail to an invented address is kept in `sim_outbox`, never sent. */
    const linkIn = async (to: string) => {
      const kept = (await db.execute(sql`
        SELECT body AS html FROM sim_outbox WHERE to_address = ${to.toLowerCase()} ORDER BY created_at DESC LIMIT 1`)).rows as { html: string }[];
      const found = [...mail].reverse().find((m) => m.to === to) ?? kept[0];
      const match = found?.html.match(/\/partner\/reset\?token=([^"&\s]+)/);
      return match ? decodeURIComponent(match[1]!) : null;
    };

    const colleague = `dev.${fixture}@example.com`;
    const invited = team
      ? await team.inviteColleague({
          partnerId: partner.id,
          email: colleague,
          name: "Karim Dev",
          role: "developer",
          byPartnerUserId: admin.id,
        })
      : { error: "no team module" };
    const inviteToken = await linkIn(colleague);
    const tooShort = team && inviteToken ? await team.setPartnerPassword(inviteToken, "short") : null;
    const chosen = team && inviteToken ? await team.setPartnerPassword(inviteToken, "karims-own-password") : null;
    const reused = team && inviteToken ? await team.setPartnerPassword(inviteToken, "somebody-elses-pass") : null;
    const karim = await checkPartnerPassword(colleague, "karims-own-password");
    check(
      "🔴 W2-X06 an admin adds a colleague, who chooses their own password from the emailed link and signs in",
      Boolean(invited.ok) && Boolean(inviteToken) && Boolean(tooShort?.error) && Boolean(chosen?.ok) &&
        Boolean(karim.partnerUserId),
      `${invited.error ?? "invited"}, link ${inviteToken ? "sent" : "missing"}, sign-in ${karim.partnerUserId ? "works" : karim.error}`,
    );
    check(
      "🔴 W2-X06 …and the link works once: the same link cannot set a second password",
      Boolean(reused?.error) && Boolean((await checkPartnerPassword(colleague, "karims-own-password")).partnerUserId),
      reused?.error ?? "reused",
    );

    const adminEmail = `admin.${fixture}@example.com`;
    const nobodyKept = async () =>
      Number(((await db.execute(sql`SELECT count(*)::int AS n FROM sim_outbox WHERE to_address = ${`nobody.${fixture}@example.com`}`)).rows[0] as { n: number }).n);
    const before = mail.length + (await nobodyKept());
    if (team) await team.requestPartnerReset(`nobody.${fixture}@example.com`);
    const unknownSent = mail.length + (await nobodyKept()) - before;
    if (team) await team.requestPartnerReset(adminEmail);
    const resetToken = await linkIn(adminEmail);
    await db.execute(sql`
      INSERT INTO partner_auth_sessions (partner_user_id, token_hash, absolute_expires_at)
      VALUES (${admin.id}, ${`w2x-${fixture}`}, now() + interval '1 hour')`);
    const tampered = team && resetToken
      ? await team.setPartnerPassword(resetToken.replace(/\.(\d+)\./, (_m, n: string) => `.${Number(n) + 1}.`), "tampered-password-1")
      : null;
    const reset = team && resetToken ? await team.setPartnerPassword(resetToken, "the-second-password-2") : null;
    const session = await one<{ revoked: Date | null }>(sql`
      SELECT revoked_at AS revoked FROM partner_auth_sessions WHERE token_hash = ${`w2x-${fixture}`}`);
    const oldWorks = Boolean((await checkPartnerPassword(adminEmail, "the-first-password-1")).partnerUserId);
    const newWorks = Boolean((await checkPartnerPassword(adminEmail, "the-second-password-2")).partnerUserId);
    check(
      "🔴 W2-X06 a forgotten password is reset from an emailed link, and every session on the old one ends",
      Boolean(reset?.ok) && !oldWorks && newWorks && session.revoked !== null,
      `reset ${reset?.ok ? "ok" : reset?.error ?? "no link"}, old ${oldWorks}, new ${newWorks}, session revoked ${session.revoked !== null}`,
    );
    check(
      "W2-X06 …an address with no account gets the same answer and no mail, and a changed link is refused",
      unknownSent === 0 && Boolean(tampered?.error),
      `${unknownSent} sent to nobody, tampered: ${tampered?.error ?? "accepted"}`,
    );

    const self = team
      ? await team.removeColleague({ partnerId: partner.id, userId: admin.id, byPartnerUserId: admin.id })
      : { error: "" };
    const lastAdmin = team
      ? await team.removeColleague({ partnerId: partner.id, userId: admin.id, byPartnerUserId: karim.partnerUserId ?? admin.id })
      : { error: "" };
    const removed = team && karim.partnerUserId
      ? await team.removeColleague({ partnerId: partner.id, userId: karim.partnerUserId, byPartnerUserId: admin.id })
      : { error: "no colleague" };
    const karimAfter = await checkPartnerPassword(colleague, "karims-own-password");
    const teamAudit = await one<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM audit_log
       WHERE action IN ('partner.user.invite', 'partner.user.remove')
         AND reason LIKE ${`partner ${partner.id}%`}`);
    check(
      "🔴 W2-X06 an admin removes a colleague, who can no longer sign in; not themselves, never the last admin; both audited",
      Boolean(removed.ok) && !karimAfter.partnerUserId && Boolean(self.error) && Boolean(lastAdmin.error) &&
        teamAudit.n === 2,
      `removed ${removed.ok ?? removed.error}, self ${self.error}, last admin ${lastAdmin.error}, audit ${teamAudit.n}`,
    );

    const signIn = readSource("app/(partner)/partner/sign-in/page.tsx");
    const developers = readSource("app/(public)/developers/page.tsx");
    const routing = readSource("lib/routing.ts");
    check(
      "🔴 W2-X06 sign-in links to the reset, /developers links to sign-in, and both password pages are open routes",
      /href=\{PARTNER_FORGOT\}/.test(signIn) && /href=\{PARTNER_SIGN_IN\}/.test(developers) &&
        /openRoutes: \[PARTNER_APPLY, PARTNER_FORGOT, PARTNER_RESET\]/.test(routing),
      "a locked-out developer, and one arriving from the docs, both have a door",
    );
    check(
      "W2-X06 …and the team is a tab in the portal",
      /"\/partner\/team"/.test(readSource("components/partner/chrome.tsx")),
      "a page nobody can find is the same as no page",
    );

    /* ================================================================ */
    /*  W2-X03 · WEBHOOKS: HOURLY, BACKOFF, FAILED, REDELIVER, TEST      */
    /* ================================================================ */

    /*
     * The queue was drained inside the daily `billing` job. It must be drained on
     * the hourly wake, and that wake must still be ONE wake an hour (the cron
     * route's header: jobs share wakes because a wake is what costs).
     *
     * 🔴 0165: `crisis` went hourly as a launch blocker, on the SAME minute as
     * `reminders`, so the two share the wake. The rule this checks is one
     * minute an hour, not one entry: two entries on one minute cost one wake.
     */
    const cron = readSource("app/api/cron/[job]/route.ts");
    const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      crons: { path: string; schedule: string }[];
    };
    const hourly = vercel.crons.filter((c) => /^\d+ \* \* \* \*$/.test(c.schedule));
    const hourlyMinutes = new Set(hourly.map((c) => c.schedule));
    const remindersBody = cron.slice(cron.indexOf("async reminders()"), cron.indexOf("async webhooks()"));
    const billingBody = cron.slice(cron.indexOf("async billing()"), cron.indexOf("async radar()"));
    check(
      "🔴 W2-X03 the webhook queue drains on the hourly wake, not inside the daily billing job",
      hourlyMinutes.size === 1 && hourly.some((c) => c.path === "/api/cron/reminders") &&
        /deliverPending\(/.test(remindersBody) && !/deliverPending\(/.test(billingBody),
      `hourly: ${hourly.map((c) => `${c.path} ${c.schedule}`).join(", ")}`,
    );

    const hasColumns = await one<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM information_schema.columns
       WHERE table_name = 'partner_webhook_deliveries'
         AND column_name IN ('next_attempt_at', 'failed_at')`);

    await skipUnless(hasColumns.n === 2, "migration 0138", "the retry columns are not on this database yet", async () => {
      const webhooks = await import("../lib/partner/webhooks");
      const { MAX_ATTEMPTS, RETRY_MINUTES } = await import("../lib/partner/retry");
      /*
       * 🔴 C16: the fixture host is an example.com name that resolves nowhere, so
       * a resolver stands in: the fixture's name answers with a public address,
       * one named `inside` answers with a private one, and anything else asks DNS.
       */
      const net = await import("../lib/net/public-url");
      const realLookup = net.resolver.lookup;
      net.resolver.lookup = async (host: string) =>
        host === new URL(hookHost).hostname
          ? [{ address: "93.184.215.14", family: 4 }]
          : host === `inside.${fixture}.example.com`
            ? [{ address: "10.0.0.7", family: 4 }]
            : realLookup(host);
      const literal = await webhooks.registerWebhook({
        partnerId: partner.id,
        url: "https://169.254.169.254/latest",
        events: ["session.completed"],
      });
      check("🔴 C16 a webhook at a private address is refused when it is saved", Boolean(literal.error) && !literal.webhook, literal.error ?? "saved");
      const inside = await webhooks.registerWebhook({
        partnerId: partner.id,
        url: `https://inside.${fixture}.example.com/in`,
        events: ["record.claimed"],
      });
      check("C16 CONTROL a public-looking name is saved, the check at saving reads the address only", Boolean(inside.webhook), inside.error ?? "");
      if (inside.webhook) {
        await webhooks.queueWebhook({ partnerId: partner.id, event: "record.claimed", subjectId: null });
        const before = endpoint.calls.length;
        await webhooks.deliverPending();
        const tried = await one<{ error: string | null; status: number | null }>(sql`
          SELECT last_error AS error, last_status AS status FROM partner_webhook_deliveries
           WHERE webhook_id = ${inside.webhook.id} AND event = 'record.claimed'`);
        check(
          "🔴 C16 …and a name that resolves inside is never called when it is sent",
          endpoint.calls.length === before && /public address/.test(tried?.error ?? ""),
          tried?.error ?? "no row",
        );
        await webhooks.disableWebhook(partner.id, inside.webhook.id);
      }
      const registered = await webhooks.registerWebhook({
        partnerId: partner.id,
        url: `${hookHost}/in`,
        events: ["session.completed"],
      });
      const hookId = registered.webhook!.id;
      await webhooks.queueWebhook({ partnerId: partner.id, event: "session.completed", subjectId: null });
      const row = () =>
        one<{ id: string; attempts: number; next: Date | null; failed: Date | null; delivered: Date | null; wait: number | null }>(sql`
          SELECT id, attempts, next_attempt_at AS next, failed_at AS failed, delivered_at AS delivered,
                 EXTRACT(EPOCH FROM next_attempt_at - now()) / 60 AS wait
            FROM partner_webhook_deliveries WHERE webhook_id = ${hookId} AND event = 'session.completed'`);
      /* Time passes by moving the schedule back to now, not by moving the clock. */
      const makeDue = (id: string) =>
        db.execute(sql`UPDATE partner_webhook_deliveries SET next_attempt_at = now() - interval '1 second' WHERE id = ${id}`);

      endpoint.status = 500;
      await webhooks.deliverPending();
      const first = await row();
      check(
        "🔴 W2-X03 a failed delivery is tried again in minutes, not tomorrow",
        first.attempts === 1 && first.failed === null && Number(first.wait) > 3 && Number(first.wait) < 7,
        `attempts ${first.attempts}, next try in ${Number(first.wait).toFixed(1)} min`,
      );

      await webhooks.deliverPending();
      const notDue = await row();
      check(
        "W2-X03 …and not before then: a run in between leaves it alone",
        notDue.attempts === 1,
        `attempts ${notDue.attempts}`,
      );

      const waits: number[] = [Number(first.wait)];
      for (let n = 2; n <= MAX_ATTEMPTS; n++) {
        await makeDue(first.id);
        await webhooks.deliverPending();
        const now = await row();
        if (now.wait !== null) waits.push(Number(now.wait));
      }
      const last = await row();
      const days = waits.reduce((a, b) => a + b, 0) / 60 / 24;
      check(
        "🔴 W2-X03 each wait is longer, over about three days, and then it has FAILED, not 'Pending' for ever",
        last.attempts === MAX_ATTEMPTS && last.failed !== null && last.next === null &&
          last.delivered === null && waits.length === RETRY_MINUTES.length &&
          waits.every((w, i) => i === 0 || w >= waits[i - 1]! - 0.1) && days > 2.5 && days < 3.5,
        `${last.attempts} tries, ${days.toFixed(2)} days, failed ${last.failed !== null}`,
      );

      await makeDue(first.id);
      const tries = endpoint.calls.length;
      await webhooks.deliverPending();
      check("W2-X03 …and a failed delivery is not drained again", endpoint.calls.length === tries, `${endpoint.calls.length - tries} sent`);

      const failing = (await webhooks.webhooksFor(partner.id)).find((h) => h.id === hookId);
      check("🔴 W2-X03 the endpoint shows Failing", failing?.failing === true, `failing ${failing?.failing}`);

      check(
        "W2-X03 every try of one delivery carries the same delivery id, so a receiver can drop a repeat",
        endpoint.calls.length === MAX_ATTEMPTS && endpoint.calls.every((c) => c.delivery === first.id),
        `${endpoint.calls.length} calls, ids ${[...new Set(endpoint.calls.map((c) => c.delivery))].join(",")}`,
      );

      const borrowed = await webhooks.redeliver({ partnerId: randomUuid(), deliveryId: first.id });
      check("W2-X03 a redelivery by another partner sends nothing", borrowed === null && endpoint.calls.length === tries, `${borrowed}`);

      endpoint.status = 200;
      const again = await webhooks.redeliver({ partnerId: partner.id, deliveryId: first.id });
      const redelivered = await row();
      const healthy = (await webhooks.webhooksFor(partner.id)).find((h) => h.id === hookId);
      check(
        "🔴 W2-X03 Redeliver sends it now, and success clears the failure and the endpoint's Failing",
        again?.ok === true && redelivered.delivered !== null && redelivered.failed === null &&
          healthy?.failing === false,
        `ok ${again?.ok}, delivered ${redelivered.delivered !== null}, failing ${healthy?.failing}`,
      );

      const beforeTest = endpoint.calls.length;
      const pinged = await webhooks.sendTestEvent({ partnerId: partner.id, webhookId: hookId });
      const pingBody = JSON.parse(endpoint.calls.at(-1)?.body ?? "{}") as Record<string, unknown>;
      check(
        "🔴 W2-X03 Send test event: a signed ping with the same fields as a delivery and a null id and ref",
        pinged?.ok === true && endpoint.calls.length === beforeTest + 1 &&
          pingBody.event === "ping" && pingBody.id === null && pingBody.ref === null &&
          Object.keys(pingBody).sort().join(",") === "at,event,id,ref",
        JSON.stringify(pingBody),
      );

      endpoint.status = 503;
      const refused = await webhooks.sendTestEvent({ partnerId: partner.id, webhookId: hookId });
      const pingRow = await one<{ failed: Date | null; next: Date | null }>(sql`
        SELECT failed_at AS failed, next_attempt_at AS next FROM partner_webhook_deliveries
         WHERE webhook_id = ${hookId} AND event = 'ping' ORDER BY created_at DESC LIMIT 1`);
      check(
        "W2-X03 …a test the endpoint refuses says so and is not retried",
        refused?.ok === false && refused.status === 503 && pingRow.failed !== null && pingRow.next === null,
        `ok ${refused?.ok}, status ${refused?.status}`,
      );

      /*
       * 🔴 C17: a subject event names the subject by OUR id, which no API returns,
       * so it carries the partner's own reference beside it. Only for the
       * partner's own subject: a subject id of another platform's carries none.
       */
      const subject = await one<{ id: string }>(sql`
        INSERT INTO partner_subjects (partner_id, external_ref) VALUES (${partner.id}, ${`${fixture}-THEIR-77`}) RETURNING id`);
      const stranger = await one<{ id: string }>(sql`
        INSERT INTO partners (name, slug, state) VALUES (${`${fixture}-other`}, ${`${fixture}-other`}, 'active') RETURNING id`);
      const foreign = await one<{ id: string }>(sql`
        INSERT INTO partner_subjects (partner_id, external_ref) VALUES (${stranger.id}, ${`${fixture}-NOT-THEIRS`}) RETURNING id`);
      await webhooks.registerWebhook({ partnerId: partner.id, url: `${hookHost}/subjects`, events: ["record.claimed"] });
      endpoint.status = 200;
      const ourSession = randomUuid();
      await webhooks.queueWebhook({ partnerId: partner.id, event: "record.claimed", subjectId: subject.id });
      await webhooks.queueWebhook({ partnerId: partner.id, event: "record.claimed", subjectId: foreign.id });
      await webhooks.queueWebhook({ partnerId: partner.id, event: "session.completed", subjectId: ourSession });
      await webhooks.deliverPending();
      const bodies = endpoint.calls.map((c) => JSON.parse(c.body) as Record<string, unknown>);
      const claimedBody = bodies.find((b) => b.id === subject.id);
      const foreignBody = bodies.find((b) => b.id === foreign.id);
      const sessionBody = bodies.find((b) => b.id === ourSession);
      check(
        "🔴 C17 record.claimed carries the partner's own reference for the subject beside our id, and nothing else new",
        claimedBody?.event === "record.claimed" && claimedBody.ref === `${fixture}-THEIR-77` &&
          Object.keys(claimedBody).sort().join(",") === "at,event,id,ref",
        JSON.stringify(claimedBody),
      );
      check(
        "C17 CONTROL another platform's subject id carries no reference, and a session event carries our session id with a null ref",
        foreignBody !== undefined && foreignBody.ref === null &&
          sessionBody?.event === "session.completed" && sessionBody.ref === null,
        JSON.stringify({ foreignBody, sessionBody }),
      );

      /*
       * 🔴 C24: the hourly drain sent one batch of 50. It now takes batch after
       * batch within a time budget, each delivery still claimed before it is sent:
       * two drains racing over more deliveries than one batch send each exactly once.
       */
      const bulk = await webhooks.registerWebhook({ partnerId: partner.id, url: `${hookHost}/bulk`, events: ["note.approved"] });
      const bulkIds = Array.from({ length: 8 }, () => randomUuid());
      for (const id of bulkIds) await webhooks.queueWebhook({ partnerId: partner.id, event: "note.approved", subjectId: id });
      const noTime = await webhooks.deliverPending({ budgetMs: 0 });
      const sentBefore = endpoint.calls.length;
      const [a, b] = await Promise.all([
        webhooks.deliverPending({ batch: 3 }),
        webhooks.deliverPending({ batch: 3 }),
      ]);
      const bulkSent = endpoint.calls
        .slice(sentBefore)
        .map((c) => JSON.parse(c.body) as { id?: string })
        .filter((body) => bulkIds.includes(body.id ?? ""));
      const leftDue = await one<{ n: number }>(sql`
        SELECT count(*)::int AS n FROM partner_webhook_deliveries
         WHERE webhook_id = ${bulk.webhook!.id} AND delivered_at IS NULL`);
      check(
        "🔴 C24 one hourly call drains more than one batch, and two racing drains send each delivery exactly once",
        bulkSent.length === bulkIds.length && new Set(bulkSent.map((body) => body.id)).size === bulkIds.length &&
          leftDue.n === 0 && a.sent + b.sent >= bulkIds.length,
        JSON.stringify({ sent: bulkSent.length, leftDue: leftDue.n, a, b }),
      );
      check(
        "C24 CONTROL with no time left it starts nothing and says more is due",
        noTime.sent + noTime.failed + noTime.gaveUp === 0 && noTime.more === true,
        JSON.stringify(noTime),
      );
    });
  } finally {
    mock.server.close();
    for (const bucket of buckets) await db.execute(sql`DELETE FROM rate_limits WHERE key = ${bucket}`);
    await db.execute(sql`DELETE FROM partner_sessions WHERE external_session_ref LIKE ${`%${fixture}%`}`);
    await db.execute(sql`DELETE FROM partner_consents WHERE external_session_ref LIKE ${`%${fixture}%`}`);
    await db.execute(sql`DELETE FROM partner_subjects WHERE external_ref LIKE ${`%${fixture}%`}`);
    await db.execute(sql`DELETE FROM partner_clinicians WHERE partner_id IN
      (SELECT id FROM partners WHERE slug = ${fixture})`);
    await db.execute(sql`DELETE FROM partner_auth_sessions WHERE partner_user_id IN
      (SELECT u.id FROM partner_users u JOIN partners p ON p.id = u.partner_id WHERE p.slug = ${fixture})`);
    await db.execute(sql`DELETE FROM sim_outbox WHERE to_address LIKE ${`%.${fixture}@example.com`}`);
    await db.execute(sql`DELETE FROM partner_users WHERE partner_id IN
      (SELECT id FROM partners WHERE slug = ${fixture})`);
    /* The key and team audit rows name the partner in `reason`, so they go by it. */
    await db.execute(sql`DELETE FROM audit_log WHERE reason LIKE
      'partner ' || (SELECT id::text FROM partners WHERE slug = ${fixture}) || '%'`);
    await db.execute(sql`DELETE FROM partner_api_keys WHERE partner_id IN
      (SELECT id FROM partners WHERE slug = ${fixture})`);
    await db.execute(sql`DELETE FROM partner_limits WHERE partner_id IN
      (SELECT id FROM partners WHERE slug = ${fixture})`);
    await db.execute(sql`DELETE FROM partners WHERE slug = ${fixture}`);
    await db.execute(sql`DELETE FROM partners WHERE slug = ${`${fixture}-other`}`);
    await db.execute(sql`DELETE FROM partners WHERE slug = ${`${fixture}-docs`}`);
    await pool.end();
  }

  finish("wave 2 partner");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

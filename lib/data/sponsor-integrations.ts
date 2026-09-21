import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import {
  partnerApiKeys,
  partnerWebhookDeliveries,
  partnerWebhooks,
  sponsors,
  SPONSOR_SCOPES,
} from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";

/**
 * The sponsor's own HR connection. PLAN.md 66.1 to 66.12, C227, C246, C265.
 *
 * ## 🔴 THE SENTENCE THIS SPRINT EXISTS FOR
 *
 * > **`employment:verify` came home.** It was a partner scope: a third party held a
 * > key and asked us about a company's staff. The company is right here, signed in,
 * > and it is their staff. The organisation an identity question is about should be
 * > the portal somebody is signed into, not a field on a form.
 *
 * ## 🔴 66.4 — THE SCOPE IS STRUCTURAL RATHER THAN A CHECK
 *
 * `mintSponsorKey` takes a `sponsorId` and nothing else that names an organisation.
 * There is no parameter a form could fill with somebody else's id, and the sponsor
 * portal has no field that asks. A key minted here belongs to the sponsor whose
 * session minted it, and that is a property of the function's signature rather than
 * a validation that could be relaxed.
 *
 * ## 🔴 66.3 — C265 IS INHERITED, NOT RE-IMPLEMENTED
 *
 * `verifyEmployment` is unchanged and still answers only about an identifier somebody
 * typed into their own enrolment minutes ago, consumed once, from
 * `enrolment_attestations`. Moving portals changed the door and nothing behind it.
 */

/** 🔴 66.5 — the systems we have steps for. "Other" is honest about being a webhook. */
export const HR_SYSTEMS = [
  { key: "workday", name: "Workday" },
  { key: "bamboohr", name: "BambooHR" },
  { key: "hibob", name: "HiBob" },
  { key: "personio", name: "Personio" },
  { key: "sap", name: "SAP SuccessFactors" },
  { key: "oracle", name: "Oracle HCM" },
  /*
   * 🔴 ON THE LIST, AND HONEST ABOUT WHAT IT IS.
   *
   * A picker with six named systems and no escape hatch tells a company on a seventh
   * that we do not support them, which is false: every one of these integrates the
   * same way underneath. "Other" says so rather than making somebody email us to find
   * out that the answer is a URL and a key.
   */
  { key: "other", name: "Generic or other" },
] as const;

export type HrSystemKey = (typeof HR_SYSTEMS)[number]["key"];

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** What the integrations page reads. One query's worth. */
export async function integrationFor(sponsorId: string) {
  const [sponsor] = await controlDb
    .select({
      enabledAt: sponsors.employmentVerificationEnabledAt,
      hrSystem: sponsors.hrSystem,
    })
    .from(sponsors)
    .where(eq(sponsors.id, sponsorId))
    .limit(1);

  const keys = await controlDb
    .select({
      id: partnerApiKeys.id,
      label: partnerApiKeys.label,
      prefix: partnerApiKeys.prefix,
      environment: partnerApiKeys.environment,
      lastUsedAt: partnerApiKeys.lastUsedAt,
      /* 🔴 66.7 — the indicator reads THIS, not lastUsedAt. See its column comment. */
      lastSuccessAt: partnerApiKeys.lastSuccessAt,
      suspendedAt: partnerApiKeys.suspendedAt,
      suspendedReason: partnerApiKeys.suspendedReason,
      revokedAt: partnerApiKeys.revokedAt,
      createdAt: partnerApiKeys.createdAt,
    })
    .from(partnerApiKeys)
    .where(
      and(
        eq(partnerApiKeys.sponsorId, sponsorId),
        /* 🔴 66.4 — theirs means no partner behind it. A partner's key is not theirs. */
        isNull(partnerApiKeys.partnerId),
      ),
    )
    .orderBy(desc(partnerApiKeys.createdAt))
    .limit(20);

  return {
    enabled: Boolean(sponsor?.enabledAt),
    enabledAt: sponsor?.enabledAt ?? null,
    hrSystem: sponsor?.hrSystem ?? null,
    keys,
  };
}

/**
 * 🔴 66.2 — TURNING IT ON IS A DELIBERATE ACT, and turning it off is one too.
 *
 * C227's whole design removed the roster: we never read a directory, never sync one,
 * and never store a staff list. This is the one thing in the product that touches
 * employment at all, so it is off by default and the sentence in front of the switch
 * says what it does before it is on.
 *
 * 🔴 SWITCHING IT OFF REVOKES THE KEYS, and that is the half a toggle usually misses.
 * A setting that says "off" while a key still answers is worse than no setting: it
 * tells an HR admin that nothing can ask about their staff, and something can.
 */
export async function setEmploymentVerification(input: {
  sponsorId: string;
  enabled: boolean;
  hrSystem: string | null;
  now?: Date;
}): Promise<{ ok?: true; error?: string }> {
  const now = input.now ?? new Date();

  const system = input.hrSystem
    ? (HR_SYSTEMS.find((candidate) => candidate.key === input.hrSystem)?.key ?? null)
    : null;

  if (input.enabled && !system) {
    return { error: "Choose the HR system you are connecting, so the steps match it." };
  }

  await controlDb
    .update(sponsors)
    .set({
      employmentVerificationEnabledAt: input.enabled ? now : null,
      hrSystem: system,
      updatedAt: now,
    })
    .where(eq(sponsors.id, input.sponsorId));

  if (!input.enabled) {
    const revoked = await controlDb
      .update(partnerApiKeys)
      .set({ revokedAt: now })
      .where(
        and(
          eq(partnerApiKeys.sponsorId, input.sponsorId),
          isNull(partnerApiKeys.partnerId),
          isNull(partnerApiKeys.revokedAt),
        ),
      )
      .returning({ id: partnerApiKeys.id });

    log.info("employment verification switched off", {
      sponsor: ref(input.sponsorId),
      revoked: revoked.length,
    });
  }

  return { ok: true };
}

/**
 * 🔴 66.4 / 66.6 — MINT THE KEY, AT THE STEP THAT NEEDS IT.
 *
 * The guide generates it where it is used rather than on a separate screen, because a
 * key minted three steps early is a key sitting in a clipboard through three steps.
 *
 * 🔴 THE SCOPE IS NOT A PARAMETER. `SPONSOR_SCOPES` is the whole list a sponsor may
 * hold and it has one entry. A `scopes` argument here would be a field a form could
 * fill, and 66.4's ruling is that a sponsor's key cannot be made to be about anything
 * else.
 *
 * 🔴 AND IT REFUSES WHILE THE SWITCH IS OFF. A key that works before somebody turned
 * the feature on is the feature being on.
 */
export async function mintSponsorKey(input: {
  sponsorId: string;
  label: string;
}): Promise<{ raw?: string; prefix?: string; error?: string }> {
  const [sponsor] = await controlDb
    .select({ enabledAt: sponsors.employmentVerificationEnabledAt })
    .from(sponsors)
    .where(and(eq(sponsors.id, input.sponsorId), eq(sponsors.state, "active")))
    .limit(1);

  if (!sponsor?.enabledAt) {
    return { error: "Turn employment verification on first. A key before that answers nothing." };
  }

  /*
   * 🔴 `live`, and there is no sandbox for this one.
   *
   * A partner's sandbox exists so an integration can be built against nobody real.
   * This endpoint answers about an identifier a real person typed into a real
   * enrolment in the last few minutes, so there is nothing to build against: a
   * sandbox would either answer about nobody, which tests nothing, or about
   * somebody, which is the live endpoint with a friendlier name.
   */
  const raw = `24t_hr_${randomBytes(24).toString("base64url")}`;

  const [created] = await controlDb
    .insert(partnerApiKeys)
    .values({
      partnerId: null,
      sponsorId: input.sponsorId,
      label: input.label.trim().slice(0, 80) || "HR connection",
      keyHash: hashKey(raw),
      prefix: raw.slice(0, 14),
      scopes: [...SPONSOR_SCOPES],
      environment: "live",
    })
    .returning({ prefix: partnerApiKeys.prefix });

  if (!created) return { error: "That key could not be created." };

  log.info("sponsor hr key minted", { sponsor: ref(input.sponsorId) });
  return { raw, prefix: created.prefix };
}

/**
 * 🔴 66.10 — REVOKE, AND A REVOKED KEY IS WHY CALLS STOPPED WORKING.
 *
 * Guarded on the key being theirs AND having no partner, so a borrowed id from the
 * partner side revokes nothing. Both conditions, because either alone leaves a way in:
 * a sponsor id names the organisation a PARTNER key may ask about, so that column
 * alone would let a sponsor revoke a partner's key about them.
 */
export async function revokeSponsorKey(input: {
  sponsorId: string;
  keyId: string;
}): Promise<{ ok: boolean }> {
  const [row] = await controlDb
    .update(partnerApiKeys)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(partnerApiKeys.id, input.keyId),
        eq(partnerApiKeys.sponsorId, input.sponsorId),
        isNull(partnerApiKeys.partnerId),
        isNull(partnerApiKeys.revokedAt),
      ),
    )
    .returning({ id: partnerApiKeys.id });

  return { ok: Boolean(row) };
}

/**
 * 🔴 66.8 / 66.9 — THE DELIVERY LOG, ON THEIR OWN PAGE, NAMING NO EMPLOYEE.
 *
 * > *They debug their side without a support ticket, and we stop being the only
 * > people who can see what happened.*
 *
 * The select list is the ruling. An event, an id, a status code, a time, and the
 * error when there was one. There is no `payload` column in it and no identifier:
 * a connection log that named the person each call was about would rebuild the
 * roster C227 removed, inside the audit trail, one row at a time.
 */
export async function deliveriesFor(sponsorId: string) {
  return controlDb
    .select({
      id: partnerWebhookDeliveries.id,
      event: partnerWebhookDeliveries.event,
      /* The HTTP status their endpoint returned, which is what they debug from. */
      lastStatus: partnerWebhookDeliveries.lastStatus,
      attempts: partnerWebhookDeliveries.attempts,
      lastError: partnerWebhookDeliveries.lastError,
      createdAt: partnerWebhookDeliveries.createdAt,
      deliveredAt: partnerWebhookDeliveries.deliveredAt,
    })
    .from(partnerWebhookDeliveries)
    .innerJoin(
      partnerWebhooks,
      eq(partnerWebhooks.id, partnerWebhookDeliveries.webhookId),
    )
    .where(
      and(
        eq(partnerWebhooks.sponsorId, sponsorId),
        /* 🔴 66.8 — theirs, which means no partner behind the registration. */
        isNull(partnerWebhooks.partnerId),
      ),
    )
    .orderBy(desc(partnerWebhookDeliveries.createdAt))
    .limit(100);
}

/**
 * 🔴 66.11 — THE SPIKE, AS A NUMBER, ON THE PAGE THAT CAN ACT ON IT.
 *
 * C246 already counts unusual attempts against a joining code. An HR admin reading
 * "47 attempts failed the identifier check this week" can go and ask why; the same
 * fact in our own logs is a fact only we can act on, and we are not the ones who know
 * whether a code went on a public poster by mistake.
 *
 * 🔴 A COUNT AND NOT A LIST. The identifiers people typed are the roster again: a
 * list of failed attempts is a list of guesses at staff numbers, which is worse than
 * the roster because it also tells somebody which guesses were close.
 */
export async function failedAttemptsFor(
  sponsorId: string,
  days = 7,
): Promise<number> {
  /*
   * 🔴 `answered_at`, NOT `consumed_at`. THIS PAGE RETURNED A 500 TO EVERY
   * COMPANY ADMIN, ALWAYS.
   *
   * `enrolment_attestations` has `answered_at` — see the table, which calls it
   * that and says "stamped on use". There has never been a `consumed_at` on
   * it. So this query threw `column "consumed_at" does not exist` on every
   * render, and `/sponsor/integrations` was a hard 500 for everybody, from the
   * day it shipped. Confirmed by opening it as the company admin: "Something
   * went wrong. The page could not be displayed."
   *
   * 🔴 WHY EVERY GATE MISSED IT. It is raw SQL inside a template literal.
   * Drizzle cannot type-check the inside of one, so `tsc` is happy, the
   * schema check is happy, and 28 gates pass over a page that cannot load.
   * Column names in raw SQL are the one place in this repo where the compiler
   * gives no cover at all, and this is what that costs.
   */
  const rows = await controlDb.execute(sql`
    SELECT count(*)::int AS n
      FROM enrolment_attestations
     WHERE sponsor_id = ${sponsorId}
       AND created_at > now() - (${days} || ' days')::interval
       AND answered_at IS NULL`);

  return Number((rows.rows[0] as { n: number } | undefined)?.n ?? 0);
}

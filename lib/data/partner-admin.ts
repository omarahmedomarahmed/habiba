import "server-only";

import { randomBytes } from "node:crypto";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { controlDb } from "@/lib/db";
import {
  partnerApiKeys,
  partnerUsers,
  partners,
  sponsors,
  type PartnerRole,
  type PartnerState,
} from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";

/**
 * Everything that CHANGES a partner. PLAN.md 42.1, 55.2, 55.3.
 *
 * The third copy of a shape sprint 53 and sprint 54 each wrote once: an enquiry creates a
 * HELD row and a phone call, an operator activates, and the first portal user is created
 * by that operator with a password set on the call.
 *
 * 🔴 THERE IS NO SELF-SERVE PATH TO AN ACTIVE PARTNER, and for this principal that
 * matters more than for the other two. An active partner can hold a key, and an
 * employment key is an identity oracle pointed at our own patients (C265). A signup form
 * that ended in a working key would mean anybody with an email address could start asking
 * whether identifiers are employed somewhere, which is the whole harm three enrolment
 * designs were spent removing.
 *
 * `devs.keysNote` used to say *there is no self-serve key*, which stopped being true when
 * 68.20 let an approved account's admin mint sandbox keys; W2-X06 cut the sentence. What
 * this file keeps true is the step before: no ACCOUNT is self-serve.
 */

/**
 * 🔴 55.2 — the enquiry. It creates a HELD partner and NO USER AND NO KEY.
 *
 * Open to a stranger, because a company with no account cannot sign in to ask for one.
 * Nothing about it reveals that anybody is enrolled anywhere, so there is nothing behind
 * it to protect.
 */
export async function applyToPartner(input: {
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  intent: string;
}): Promise<{ ok?: true; error?: string }> {
  const name = input.name.trim().slice(0, 200);
  const contactName = input.contactName.trim().slice(0, 120);
  const contactEmail = input.contactEmail.trim().toLowerCase().slice(0, 200);
  const contactPhone = input.contactPhone.trim().slice(0, 40);
  /* Read by an operator before the call, never by code. 2000 so it can be a paragraph. */
  const intent = input.intent.trim().slice(0, 2000);

  if (!name) return { error: "Tell us what the company is called." };
  if (!contactName) return { error: "Tell us who we should speak to." };
  if (!contactEmail.includes("@")) return { error: "That email address does not look right." };
  if (!contactPhone) return { error: "We need a phone number to call you on." };
  if (!intent) return { error: "Tell us what you want to build." };

  /*
   * A slug, suffixed with randomness rather than a counter, for the reason the clinic's
   * is: a counter needs a read before the write, and two companies with the same name
   * arriving in the same second is exactly the race a unique index exists to lose safely.
   */
  const slug = `${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)}-${randomBytes(3).toString("hex")}`;

  await controlDb.insert(partners).values({
    name,
    slug,
    /* 🔴 42.1 — held. The column's default is `held` as well, so both say it. */
    state: "held" as PartnerState,
    contactName,
    contactEmail,
    contactPhone,
    intent,
  });

  log.info("partner enquiry received");
  return { ok: true };
}

/**
 * 🔴 42.1 — an operator activates. There is no other way in.
 *
 * `getPartnerActor` and `authenticateKey` both read `partners.state` in their WHERE
 * clauses, so suspending a partner closes the portal AND stops every key on the next
 * call, with no second mechanism to keep in step.
 *
 * 🔴 AND IT TOUCHES NOTHING ELSE. It does not end a session, unverify a clinician, or
 * reach a patient. A clinician who was launched from a partner keeps their own account,
 * their own verification and their own grants: those were never the partner's to hold.
 */
export async function setPartnerState(
  partnerId: string,
  state: PartnerState,
): Promise<{ ok?: true; error?: string }> {
  const [partner] = await controlDb
    .select({ id: partners.id })
    .from(partners)
    .where(eq(partners.id, partnerId))
    .limit(1);

  if (!partner) return { error: "That partner no longer exists." };

  await controlDb
    .update(partners)
    .set({ state, updatedAt: new Date() })
    .where(eq(partners.id, partnerId));

  log.info("partner state changed", { partner: ref(partnerId), state });
  return { ok: true };
}

/** 55.2 — the first portal user, created by an operator with a password set on the call. */
export async function createPartnerUser(input: {
  partnerId: string;
  email: string;
  name: string | null;
  password: string;
  role: PartnerRole;
}): Promise<{ ok?: true; error?: string }> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) return { error: "That email address does not look right." };
  if (input.password.length < 12) return { error: "Use at least twelve characters." };

  try {
    await controlDb.insert(partnerUsers).values({
      partnerId: input.partnerId,
      email,
      name: input.name?.trim().slice(0, 120) || null,
      passwordHash: await hashPassword(input.password),
      role: input.role,
    });
  } catch {
    /*
     * The unique index is across partners, not within one, so this also catches an
     * address that already works at a different integrator. One message either way:
     * which of the two it was is a fact about another customer.
     */
    return { error: "There is already an account with that email address." };
  }

  return { ok: true };
}

/**
 * The partner's door. Constant work either way.
 *
 * The same construction as the clinician's, the sponsor's and the clinic manager's: a
 * response that is faster for an unknown address is an account enumerator, and this
 * one's list is which companies are integrating with us.
 */
export async function checkPartnerPassword(
  email: string,
  password: string,
): Promise<{ partnerUserId?: string; error?: string }> {
  const [user] = await controlDb
    .select({
      id: partnerUsers.id,
      passwordHash: partnerUsers.passwordHash,
      state: partners.state,
    })
    .from(partnerUsers)
    .innerJoin(partners, eq(partners.id, partnerUsers.partnerId))
    .where(and(eq(partnerUsers.email, email.trim().toLowerCase()), isNull(partnerUsers.deletedAt)))
    .limit(1);

  if (!user?.passwordHash) {
    await hashPassword(password);
    return { error: "That email address and password do not match." };
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    return { error: "That email address and password do not match." };
  }

  /*
   * A held or suspended partner gets the same refusal, and deliberately not a helpful
   * one: "your account is suspended" told to whoever holds the address is a fact about a
   * commercial relationship, and when the suspension was C265's rate limiter it is also a
   * fact about what we detected.
   */
  if (user.state !== "active") {
    return { error: "That email address and password do not match." };
  }

  await controlDb
    .update(partnerUsers)
    .set({ lastSignInAt: new Date() })
    .where(eq(partnerUsers.id, user.id));

  return { partnerUserId: user.id };
}

/** 55.2 — every partner, for the admin queue. No clinician, no patient, no session. */
export async function allPartners() {
  return controlDb
    .select({
      id: partners.id,
      name: partners.name,
      state: partners.state,
      contactName: partners.contactName,
      contactEmail: partners.contactEmail,
      contactPhone: partners.contactPhone,
      intent: partners.intent,
      /* 🔴 68.21 — what the owner reads before approving a production key. */
      documentsUrl: partners.documentsUrl,
      approvedAt: partners.approvedAt,
      createdAt: partners.createdAt,
    })
    .from(partners)
    .orderBy(desc(partners.createdAt));
}

/** 55.2 — their portal users, for the admin queue. Email and role, never a password hash. */
export async function partnerUsersFor(partnerId: string) {
  return controlDb
    .select({ id: partnerUsers.id, email: partnerUsers.email, role: partnerUsers.role })
    .from(partnerUsers)
    .where(and(eq(partnerUsers.partnerId, partnerId), isNull(partnerUsers.deletedAt)))
    .orderBy(partnerUsers.email);
}

/**
 * 🔴 HOW MANY KEYS, as a COUNT rather than a list.
 *
 * `keysFor` exists and returns rows, and calling it here for its `.length` would read every
 * prefix, scope and sponsor name into an operator's page for a number. A count is what the
 * question needs; the prefixes are what somebody pastes into a support ticket.
 *
 * Live keys only: a revoked one is not a key this partner has.
 */
export async function keyCountFor(partnerId: string): Promise<number> {
  const [row] = await controlDb
    .select({ count: sql<number>`count(*)::int` })
    .from(partnerApiKeys)
    .where(and(eq(partnerApiKeys.partnerId, partnerId), isNull(partnerApiKeys.revokedAt)));

  return row?.count ?? 0;
}

/**
 * 🔴 C265 — the sponsors a key may be pointed at, for the one dropdown that needs them.
 *
 * An employment key must name exactly one organisation, so the form that mints one has
 * to offer a choice. Name and id only: a sponsor's pot balance, roster size and spend are
 * none of a partner operator's business, and this list is read on the partner's own
 * screen.
 */
export async function sponsorChoices() {
  return controlDb
    .select({ id: sponsors.id, name: sponsors.name })
    .from(sponsors)
    .where(eq(sponsors.state, "active"))
    .orderBy(sponsors.name);
}

/**
 * 🔴 68.21 / C264 — APPROVE A PARTNER FOR PRODUCTION. A NAMED HUMAN, EVERY TIME.
 *
 * *Documents, a named contact, a phone number, an email, and an admin approval.*
 *
 * Separate from `setPartnerState`, which is the commercial relationship, because this
 * is a different decision about a different risk. A partner can be `active` and
 * unapproved all day: they build against sandbox, which reaches nobody. Approval is
 * the moment their keys can touch a real person's session, and it is the one C264
 * calls the owner's act.
 *
 * 🔴 `approvedByUserId` IS REQUIRED BY THE DATABASE, not by this function's politeness.
 * `partners_approval_pair` refuses a row with one and not the other, so an approval
 * with nobody behind it cannot be written by a script, a fixture, or a future endpoint
 * that forgot.
 *
 * 🔴 AND IT REFUSES WITH NO DOCUMENTS, in a sentence rather than silently. The
 * documents are the whole reason this step exists: without them the approval is an
 * operator clicking a button about a company they have read a form from.
 */
export async function approveForProduction(input: {
  partnerId: string;
  byUserId: string;
}): Promise<{ ok?: true; error?: string }> {
  const [partner] = await controlDb
    .select({
      documentsUrl: partners.documentsUrl,
      contactName: partners.contactName,
      contactPhone: partners.contactPhone,
      approvedAt: partners.approvedAt,
    })
    .from(partners)
    .where(eq(partners.id, input.partnerId))
    .limit(1);

  if (!partner) return { error: "That partner no longer exists." };
  if (partner.approvedAt) return { error: "That partner is already approved." };

  if (!partner.documentsUrl || !partner.contactName || !partner.contactPhone) {
    return {
      error:
        "Documents, a named contact and a phone number first. Approving without them is approving a form.",
    };
  }

  await controlDb
    .update(partners)
    .set({
      approvedAt: new Date(),
      approvedByUserId: input.byUserId,
      updatedAt: new Date(),
    })
    .where(and(eq(partners.id, input.partnerId), isNull(partners.approvedAt)));

  log.info("partner approved for production", { partner: ref(input.partnerId) });
  return { ok: true };
}

/**
 * 🔴 68.21 — AND IT CAN BE WITHDRAWN, which is the half an approval flow forgets.
 *
 * Clearing `approvedAt` stops new LIVE keys being minted. It does not revoke the keys
 * they already hold, and that is deliberate: revoking a live key mid-afternoon stops
 * transcription in rooms that are open, and a commercial dispute with a platform must
 * never arrive in somebody's session. `revokeKey` is the separate, deliberate act for
 * when it must.
 */
export async function withdrawApproval(partnerId: string): Promise<{ ok: true }> {
  await controlDb
    .update(partners)
    .set({ approvedAt: null, approvedByUserId: null, updatedAt: new Date() })
    .where(eq(partners.id, partnerId));

  log.warn("partner production approval withdrawn", { partner: ref(partnerId) });
  return { ok: true };
}

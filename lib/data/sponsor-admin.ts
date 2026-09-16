import "server-only";

import { randomBytes } from "node:crypto";

import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { controlDb } from "@/lib/db";
import {
  IDENTIFIER_KINDS,
  sponsorCodes,
  sponsorIdentifierFields,
  sponsorPots,
  sponsorUsers,
  sponsors,
  type Entity,
  type IdentifierKind,
  type SponsorKind,
  type SponsorState,
} from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";

/**
 * Everything that CHANGES a sponsor. PLAN.md 53.5 to 53.9, C236, C237, C238.
 *
 * Separate from `lib/data/sponsors.ts`, which is the wall: that file is what a
 * sponsor may READ about the people they fund, and every function in it is
 * shaped by C227's select lists. This one is about the sponsor's own account —
 * their code, their identifier fields, whether they are listed — and none of it
 * touches a person or an enrolment.
 *
 * Two files rather than one because the wall is easier to hold when the
 * functions that could breach it live together and nothing else does.
 */

/** 53.7 / C238 — the cap. More fields is more of a person's identity collected. */
export const MAX_IDENTIFIER_FIELDS = 2;

/**
 * 🔴 53.5 — the enquiry, and the account it creates is HELD.
 *
 * *"The account is held, not active."* Held is the default in the column, so a
 * missing `state` here would be safe rather than open, which is the direction a
 * default should fail in. It is passed explicitly anyway: a reader should not
 * have to open the schema to learn whether a stranger's form creates a live
 * corporate account.
 *
 * No password and no pot. Both are created by an admin after the call, which is
 * 53.6, and the pot needs terms before it can hold money (C233). So the most an
 * enquiry can produce is a row and a phone call.
 */
export async function applyToSponsor(input: {
  name: string;
  kind: SponsorKind;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactBestTime: string;
}): Promise<{ ok?: true; error?: string }> {
  const name = input.name.trim().slice(0, 200);
  const contactName = input.contactName.trim().slice(0, 120);
  const contactEmail = input.contactEmail.trim().toLowerCase().slice(0, 200);
  const contactPhone = input.contactPhone.trim().slice(0, 40);

  if (!name) return { error: "Tell us what the organisation is called." };
  if (!contactName) return { error: "Tell us who we should speak to." };
  if (!contactEmail.includes("@")) return { error: "That email address does not look right." };
  if (!contactPhone) return { error: "We need a phone number to call you on." };

  await controlDb.insert(sponsors).values({
    name,
    kind: input.kind,
    state: "held" as SponsorState,
    /*
     * 🔴 C236 — UNLISTED IS THE DEFAULT, and an enquiry cannot change that.
     *
     * There is no field on the form for it. Being listed in a public picker is
     * a decision an organisation makes deliberately, later, knowing that it
     * tells the world they buy therapy for their staff.
     */
    listedPublicly: false,
    /*
     * The entity and currency an enquiry lands in. `us` because the Egyptian
     * entity does not take a corporate payment until counsel has confirmed
     * e-invoicing (C241), and `topUpPot` refuses `eg` for that reason. An
     * operator moves it when that changes.
     */
    entity: "us",
    currency: "usd",
    contactName,
    contactEmail,
    contactPhone,
    contactBestTime: input.contactBestTime.trim().slice(0, 120) || null,
  });

  log.info("corporate enquiry received");
  return { ok: true };
}

/**
 * 🔴 53.6 — an admin activates. There is no self-serve path to `active`.
 *
 * The state is the only thing that decides whether a portal exists:
 * `getSponsorActor` has `state = 'active'` in its WHERE clause, so suspending an
 * account signs everybody out of it on their next request without a second
 * mechanism to keep in step.
 *
 * 🔴 Suspending a sponsor does not pause anybody's funding or touch any record.
 * It closes the portal. C235's rule is about the PATIENT: a commercial dispute
 * with an employer must never reach a person in a session, and the only way to
 * be sure of that is for this function to write one column.
 */
export async function setSponsorState(
  sponsorId: string,
  state: SponsorState,
): Promise<{ ok: true }> {
  /*
   * 🔴 C256 / 53.19b — ACTIVATING STARTS THE CYCLE CLOCK, and nothing else does.
   *
   * `pauseUnverified` requires `verify_cycle_started_at` to be set, so without
   * this line the re-verification cycle would never fire for anybody and the
   * whole of C247 would be a table column and a job that does nothing. That is
   * the shape of defect this repository keeps finding: a mechanism wired at one
   * end.
   *
   * Set only on the way IN to `active`, using `COALESCE` so a suspended account
   * coming back does not restart everybody's window and hand every roster row a
   * fresh date on the same day — which would be a visible event about the
   * organisation on a screen that is supposed to carry no events at all.
   */
  await controlDb
    .update(sponsors)
    .set({
      state,
      verifyCycleStartedAt:
        state === "active"
          ? sql`COALESCE(${sponsors.verifyCycleStartedAt}, now())`
          : sponsors.verifyCycleStartedAt,
      updatedAt: new Date(),
    })
    .where(eq(sponsors.id, sponsorId));

  log.info("sponsor state changed", { sponsor: ref(sponsorId), state });
  return { ok: true };
}

/**
 * 🔴 74.5 — WHICH ENTITY BILLS THIS CUSTOMER, WHICH DECIDES WHICH RAIL THEY ARE ON.
 *
 * `applyToSponsor` lands every enquiry on `us` and its comment said "an operator
 * moves it when that changes". Nothing did. So an Egyptian company applied,
 * landed on the US entity, and was offered a corporate card charge into an
 * entity that cannot invoice them — while the transfer rail built for exactly
 * them was unreachable, because `sponsorNeedsTransfer` reads this column.
 *
 * 🔴 IT IS AN OPERATOR'S DECISION AND NOT A FORM FIELD. Which legal entity
 * bills a customer is a commercial and tax question answered by a person who
 * has seen the paperwork, not something a lead form guesses from a phone number.
 *
 * 🔴 AND IT IS REFUSED ONCE MONEY HAS MOVED. Moving the entity under a pot that
 * already holds a balance changes which company's books that money is in,
 * retrospectively, with an invoice already issued against the old one. That is
 * not a settings change, it is an accounting event, and it needs a person
 * closing one account and opening another.
 */
export async function setSponsorEntity(
  sponsorId: string,
  entity: Entity,
): Promise<{ ok?: true; error?: string }> {
  const [pot] = await controlDb
    .select({ balanceCents: sponsorPots.balanceCents })
    .from(sponsorPots)
    .where(eq(sponsorPots.sponsorId, sponsorId))
    .limit(1);

  if ((pot?.balanceCents ?? 0) > 0) {
    return {
      error:
        "Their pot already holds money. Moving the entity now would move that balance into another company's books after we invoiced it. Close this account and open a new one.",
    };
  }

  await controlDb
    .update(sponsors)
    .set({
      entity,
      /* 🔴 The currency follows the entity. Two columns, one decision. */
      currency: entity === "eg" ? "egp" : "usd",
      updatedAt: new Date(),
    })
    .where(eq(sponsors.id, sponsorId));

  log.info("sponsor entity changed", { sponsor: ref(sponsorId), entity });
  return { ok: true };
}

/** 53.6 — the first portal user, created by an admin with a password they set. */
export async function createSponsorUser(input: {
  sponsorId: string;
  email: string;
  name: string | null;
  password: string;
  role: "admin" | "viewer";
}): Promise<{ ok?: true; error?: string }> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) return { error: "That email address does not look right." };
  if (input.password.length < 12) return { error: "Use at least twelve characters." };

  try {
    await controlDb.insert(sponsorUsers).values({
      sponsorId: input.sponsorId,
      email,
      name: input.name?.trim().slice(0, 120) || null,
      passwordHash: await hashPassword(input.password),
      role: input.role,
    });
  } catch {
    return { error: "There is already an account with that email address." };
  }

  return { ok: true };
}

/**
 * 🔴 53.13 / C233 — the pot is opened WITH its terms, or not at all.
 *
 * Both arguments are required and neither may be empty, because the database
 * refuses a pot holding money without them and a pot created without them is a
 * pot somebody will try to top up on a Friday afternoon. The terms are agreed
 * before any deal, which is what C232's amendment made a precondition of 53.10
 * rather than a parallel task.
 */
export async function openPot(input: {
  sponsorId: string;
  refundPolicy: string;
  expiresAt: Date;
  overdraftCents: number;
  /**
   * 🔴 THE WELCOME CREDIT, AND WITHOUT IT THE OFFER COULD NOT BE GIVEN AT ALL.
   *
   * The plan says a company or university gets $100 of pot credit, and until
   * this sprint **no screen in the product could put it there.** Both ways money
   * reaches a pot, the card path and the transfer path, enforce
   * `sponsor.minTopUpCents`, which is $5,000, and the `sponsor` settings group
   * is not writable from `/admin/settings`. So the one commercial offer the
   * whole go-to-market rests on was unreachable.
   *
   * A minimum is the right rule for a top-up and the wrong rule for a grant.
   * They are different acts: a top-up is a customer BUYING credit, and the floor
   * stops us doing five-dollar bank reconciliations forever. A welcome credit is
   * us GIVING it, and there is nobody to under-pay.
   *
   * So it is granted here, by an operator opening the pot, and it is capped by
   * `sponsor.maxWelcomeCreditCents`.
   *
   * 🔴 76.1 — THAT CAP USED TO BE THE TOP-UP FLOOR, AND THE COINCIDENCE BROKE.
   *
   * The rule was "anything at or above `minTopUpCents` is a purchase", which
   * read sensibly while the floor was $5,000 and the credit was $100. Dropping
   * the floor to $100 turned it into a guard that refused the exact offer the
   * plan promises every company, on the boundary, with a message about the
   * payments queue that would have made no sense to the operator reading it.
   *
   * Two numbers now, because they answer two questions: the floor is the
   * smallest thing somebody may BUY, and the cap is the largest thing we will
   * GIVE away. Nothing says they have to move together.
   */
  welcomeCreditCents?: number;
}): Promise<{ ok?: true; error?: string }> {
  const policy = input.refundPolicy.trim();
  if (!policy) return { error: "The refund terms have to be written down first." };
  if (Number.isNaN(input.expiresAt.getTime())) return { error: "Set an expiry date." };

  const credit = Math.max(0, Math.round(input.welcomeCreditCents ?? 0));

  if (credit > 0) {
    const { getSettings } = await import("@/lib/settings");
    const { formatUsd } = await import("@/lib/billing/plans");
    const settings = await getSettings();
    if (credit > settings.sponsor.maxWelcomeCreditCents) {
      return {
        error: `The most that can be given away is ${formatUsd(settings.sponsor.maxWelcomeCreditCents)}. Anything larger is a top-up, and a top-up is money somebody sends us through the payments queue.`,
      };
    }
  }

  try {
    await controlDb.insert(sponsorPots).values({
      sponsorId: input.sponsorId,
      refundPolicy: policy.slice(0, 4_000),
      expiresAt: input.expiresAt,
      /*
       * 🔴 C239 — the overdraft is how "a session that has started always
       * completes and is always paid" is true without being unbounded, and the
       * database refuses a balance below it.
       */
      overdraftCents: Math.max(0, Math.round(input.overdraftCents)),
      /*
       * 🔴 75.8 — AND A LEG IS POSTED FOR IT BELOW, WHICH THERE WAS NOT.
       *
       * The note that stood here said a welcome credit needs no ledger leg,
       * *"which is how a confirmed top-up behaves too"*. That was not true of
       * either rail: `topUpPot` posts `sponsor_pot` negative at the moment the
       * money arrives, and the manual rail now does the same.
       *
       * So a pot opened with a credit had a balance every booking decision
       * could spend and no leg anywhere. `reconcilePots` reports exactly that
       * gap as drift, and `ledgerPotBalance` is what the SPONSOR is shown, so
       * a company granted $100 read $0 on its own screen. The plan gives all
       * three companies a welcome credit, so all three would have drifted.
       */
      balanceCents: credit,
    });
  } catch {
    return { error: "This account already has a pot." };
  }

  if (credit > 0) {
    /*
     * 🔴 `platform_expense`, not `cash`, and the distinction is the whole
     * point of counting it this way. No money arrived: we gave a company
     * therapy it did not pay for, and we will pay a clinician real money the
     * first time somebody spends it. The plan already treats the credit as
     * cash leaving rather than as a discount, and this is that sentence in
     * the books.
     */
    const { journal } = await import("@/lib/billing/ledger");
    await journal({
      kind: "pot_topup",
      refType: "sponsor",
      refId: input.sponsorId,
      legs: [
        {
          account: "platform_expense",
          amountCents: credit,
          memo: "Welcome credit granted to a new employer",
        },
        {
          account: "sponsor_pot",
          amountCents: -credit,
          memo: "Held for this sponsor until a session spends it",
        },
      ],
    });

    log.info("welcome credit granted", { sponsor: ref(input.sponsorId), amountCents: credit });
  }

  return { ok: true };
}

/**
 * 🔴 53.9 / C237 — rotate the joining code, and the old one dies.
 *
 * Revoked rather than deleted, and the new one is a new row: a code that was
 * printed on a poster in a building we no longer fund has to stop working and
 * has to stay in the record. A dead code is answered with one sentence that
 * names nothing (C120), which `lookupCode` does.
 *
 * 🔴 THE CODE CARRIES THE SPONSOR'S IDENTITY AND NOTHING ELSE. It is not a
 * token, it has no signature and it authorises nothing on its own: crossing the
 * gate needs the identifier as well, and the person has to be signed in. So a
 * code read off a poster by a stranger is worth exactly what the poster is.
 *
 * Ambiguous characters are left out. This is typed off a wall by somebody
 * standing in a corridor, and `0`/`O` and `1`/`I` are the two mistakes everybody
 * makes.
 */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export async function rotateCode(sponsorId: string): Promise<{ code: string }> {
  await controlDb
    .update(sponsorCodes)
    .set({ revokedAt: new Date() })
    .where(and(eq(sponsorCodes.sponsorId, sponsorId), isNull(sponsorCodes.revokedAt)));

  /*
   * Retried on a collision rather than assumed unique. The unique index is the
   * authority; a 32^8 space makes this loop run once in practice and the loop is
   * what makes "in practice" not a claim anybody has to trust.
   */
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const bytes = randomBytes(8);
    const code = Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
    try {
      await controlDb.insert(sponsorCodes).values({ sponsorId, code });
      log.info("joining code rotated", { sponsor: ref(sponsorId) });
      return { code };
    } catch {
      continue;
    }
  }

  throw new Error("Could not mint a joining code");
}

/**
 * 🔴 53.7 / C238 / C248 — what the sponsor asks for, from a constrained set.
 *
 * *"Never a national identifier, never health information, never free text."*
 * Three separate refusals, in three places:
 *
 *   1. `kind` is one of two values and the database has a CHECK. There is no
 *      `national_id`, no `passport`, no `date_of_birth` and no `condition`, so a
 *      sponsor cannot ask for one by typing it.
 *   2. The shape hint is a DESCRIPTION and the database refuses one containing a
 *      run of four digits or an `@`. "For example, 20215544" is a working
 *      template handed to whoever walks past the poster.
 *   3. Two fields maximum. A cap is the only defence against a form that grows
 *      one reasonable-sounding question at a time until it is a health survey.
 */
export async function setIdentifierField(input: {
  sponsorId: string;
  kind: IdentifierKind;
  domain: string | null;
  pattern: string | null;
  shapeHint: string | null;
}): Promise<{ ok?: true; error?: string }> {
  if (!IDENTIFIER_KINDS.includes(input.kind)) {
    return { error: "That is not something we can check." };
  }

  const existing = await controlDb
    .select({ id: sponsorIdentifierFields.id })
    .from(sponsorIdentifierFields)
    .where(eq(sponsorIdentifierFields.sponsorId, input.sponsorId));

  if (existing.length >= MAX_IDENTIFIER_FIELDS) {
    return { error: "You can ask for two things at most." };
  }

  const domain = input.domain?.trim().toLowerCase().replace(/^@+/, "") || null;

  if (input.kind === "domain_email" && !domain) {
    return { error: "Which email domain should we check against?" };
  }
  if (input.kind === "domain_email" && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain!)) {
    return { error: "That does not look like a domain." };
  }

  /*
   * 🔴 An anchored pattern, validated HERE rather than trusted at match time.
   *
   * `matchesGate` anchors what it is given, so an unanchored pattern cannot
   * match a substring. A pattern that does not COMPILE is the other half: it
   * would throw inside enrolment, for every person, and read as "that could not
   * be activated" forever.
   */
  if (input.kind === "id_number") {
    if (!input.pattern?.trim()) return { error: "Describe the shape of a valid number." };
    try {
      new RegExp(input.pattern);
    } catch {
      return { error: "We could not read that shape. Ask us and we will set it up." };
    }
  }

  try {
    await controlDb.insert(sponsorIdentifierFields).values({
      sponsorId: input.sponsorId,
      kind: input.kind,
      domain,
      pattern: input.kind === "id_number" ? input.pattern!.trim().slice(0, 300) : null,
      shapeHint: input.shapeHint?.trim().slice(0, 200) || null,
    });
  } catch {
    /*
     * The database refused it, and the likely refusal is the one that matters:
     * `sponsor_identifier_no_specimen`. Say what to do instead of naming a
     * constraint.
     */
    return {
      error:
        "Describe the shape rather than giving an example. A real looking number on a poster is a number anybody can use.",
    };
  }

  return { ok: true };
}

export async function removeIdentifierField(
  sponsorId: string,
  fieldId: string,
): Promise<{ ok: true }> {
  await controlDb
    .delete(sponsorIdentifierFields)
    .where(
      and(
        eq(sponsorIdentifierFields.id, fieldId),
        /* Scoped in the WHERE. A borrowed field id removes nothing. */
        eq(sponsorIdentifierFields.sponsorId, sponsorId),
      ),
    );

  return { ok: true };
}

/**
 * 🔴 53.8 / C236 — listed publicly, or reachable only by the code.
 *
 * Unlisted is the default and this is the only thing that changes it. Being in a
 * public picker says "this organisation buys therapy for its staff", which is
 * theirs to say and not ours to assume.
 */
export async function setListed(sponsorId: string, listed: boolean): Promise<{ ok: true }> {
  await controlDb
    .update(sponsors)
    .set({ listedPublicly: listed, updatedAt: new Date() })
    .where(eq(sponsors.id, sponsorId));

  return { ok: true };
}

/**
 * Sign a sponsor user in. PLAN.md 53.4.
 *
 * 🔴 One message for a wrong email and a wrong password, and the hash is
 * computed either way. The same construction `lib/auth/actions.ts` uses: a
 * response that is faster for an unknown address is an account enumerator, and a
 * corporate portal's user list is a list of who buys therapy for their staff.
 */
export async function checkSponsorPassword(
  email: string,
  password: string,
): Promise<{ sponsorUserId?: string; error?: string }> {
  const [user] = await controlDb
    .select({
      id: sponsorUsers.id,
      passwordHash: sponsorUsers.passwordHash,
      state: sponsors.state,
    })
    .from(sponsorUsers)
    .innerJoin(sponsors, eq(sponsors.id, sponsorUsers.sponsorId))
    .where(and(eq(sponsorUsers.email, email.trim().toLowerCase()), isNull(sponsorUsers.deletedAt)))
    .limit(1);

  if (!user?.passwordHash) {
    await hashPassword(password);
    return { error: "That email address and password do not match." };
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    return { error: "That email address and password do not match." };
  }

  /*
   * A held or suspended account gets the same refusal as a wrong password, and
   * deliberately not a helpful one. "Your account is suspended" told to whoever
   * has the address is a fact about a commercial relationship.
   */
  if (user.state !== "active") {
    return { error: "That email address and password do not match." };
  }

  await controlDb
    .update(sponsorUsers)
    .set({ lastSignInAt: new Date() })
    .where(eq(sponsorUsers.id, user.id));

  return { sponsorUserId: user.id };
}

/** 53.6 — every sponsor, for the admin list. No person, no enrolment, no count. */
export async function allSponsors() {
  return controlDb
    .select({
      id: sponsors.id,
      name: sponsors.name,
      kind: sponsors.kind,
      state: sponsors.state,
      listedPublicly: sponsors.listedPublicly,
      /* 🔴 74.5 — which of our companies bills them, which decides their rail. */
      entity: sponsors.entity,
      contactName: sponsors.contactName,
      contactEmail: sponsors.contactEmail,
      contactPhone: sponsors.contactPhone,
      contactBestTime: sponsors.contactBestTime,
      createdAt: sponsors.createdAt,
    })
    .from(sponsors)
    .orderBy(desc(sponsors.createdAt));
}

/** The pot's terms, for the admin screen and for the top-up screen's small print. */
export async function potTerms(sponsorId: string) {
  const [pot] = await controlDb
    .select({
      id: sponsorPots.id,
      refundPolicy: sponsorPots.refundPolicy,
      expiresAt: sponsorPots.expiresAt,
      overdraftCents: sponsorPots.overdraftCents,
    })
    .from(sponsorPots)
    .where(eq(sponsorPots.sponsorId, sponsorId))
    .limit(1);

  return pot ?? null;
}

/** The portal users on one account, for the admin screen. */
export async function sponsorUsersFor(sponsorId: string) {
  return controlDb
    .select({
      id: sponsorUsers.id,
      email: sponsorUsers.email,
      name: sponsorUsers.name,
      role: sponsorUsers.role,
      lastSignInAt: sponsorUsers.lastSignInAt,
    })
    .from(sponsorUsers)
    .where(and(eq(sponsorUsers.sponsorId, sponsorId), isNull(sponsorUsers.deletedAt)))
    .orderBy(asc(sponsorUsers.email));
}

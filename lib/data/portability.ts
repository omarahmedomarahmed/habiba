import "server-only";

import { randomInt } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";

import { audit } from "@/lib/audit";
import type { Actor } from "@/lib/auth/session";
import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import {
  historyAsks,
  historyGrants,
  notifications,
  patientAccounts,
  patientInvites,
  people,
  therapistVerifications,
  users,
} from "@/lib/db/schema";
import { env } from "@/lib/env";
import { fullName } from "@/lib/utils";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("lib/data/portability.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


/**
 * Portability. PLAN.md 27.1 to 27.8, C102b, C106, C107, C108, C131.
 *
 * ## 🔴 The mechanism the pitch was missing
 *
 * "Take your record to your next therapist" was a sentence on a marketing page
 * with nothing behind it. `requestGrant` takes a *clinician* actor; there was
 * no patient-initiated share anywhere.
 *
 * The fix keeps therapist-initiated requests as the mechanism, because a
 * requester who holds an account is somebody we have verified, and adds a
 * patient-side **invite**:
 *
 *   1. the patient generates a code (`createInvite`);
 *   2. the new clinician redeems it (`redeemInvite`), which creates a
 *      **pending request** and nothing else;
 *   3. the patient approves it in one tap, through the existing grant flow.
 *
 * At no point does redeeming a code produce access. That is C107's ruling
 * expressed in the shape of the flow rather than in a warning: a grant needs
 * the patient's own authenticated action, and there is no clinician path that
 * ends in one.
 *
 * ## And the invariant underneath all of it (C106)
 *
 * A grant cannot be **held** by a clinician whose verification is not
 * approved. That is a trigger in migration 0060, not a check in this file,
 * because the whole "only certified therapists" claim rests on it and a rule
 * that lives in one function is a rule the second caller forgets.
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Six characters in two groups: read across a desk, typed once. */
function mintCode(): string {
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    if (i === 3) out += "-";
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return out;
}

/** 27.3 — thirty days. Long enough to book an appointment, short enough to expire. */
export const INVITE_DAYS = 30;

export type Invite = {
  id: string;
  code: string;
  expiresAt: Date;
  redeemedAt: Date | null;
  redeemedBy: string | null;
  revokedAt: Date | null;
};

export async function invitesForPerson(personId: string): Promise<Invite[]> {
  const rows = await db
    .select({
      id: patientInvites.id,
      code: patientInvites.code,
      expiresAt: patientInvites.expiresAt,
      redeemedAt: patientInvites.redeemedAt,
      revokedAt: patientInvites.revokedAt,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(patientInvites)
    .leftJoin(users, eq(users.id, patientInvites.redeemedByUserId))
    .where(eq(patientInvites.personId, personId))
    .orderBy(desc(patientInvites.createdAt))
    .limit(20);

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    expiresAt: row.expiresAt,
    redeemedAt: row.redeemedAt,
    redeemedBy: row.firstName ? fullName(row.firstName, row.lastName) : null,
    revokedAt: row.revokedAt,
  }));
}

export type InviteResult = { ok: true; invite: Invite } | { ok: false; error: string };

/**
 * The patient makes one.
 *
 * At most three live at once. An invite is a code somebody is carrying around
 * on a piece of paper, and a patient with eleven live codes has lost track of
 * who holds what, which is the opposite of the control this is supposed to be.
 */
/**
 * 🔴 Ruling 5 flow 4: the QR a patient shows their therapist in the room.
 * Ten minutes and single use, so a photo of it is worthless by the time
 * anybody could use it, and it asks for 24 hours of access, not open-ended.
 */
export const QUICK_INVITE_MINUTES = 10;

export async function createInvite(input: {
  personId: string;
  accountId: string;
  /** A short-lived code for a QR shown in the room. Days otherwise. */
  minutes?: number;
}): Promise<InviteResult> {
  const now = new Date();

  const live = await db
    .select({ id: patientInvites.id })
    .from(patientInvites)
    .where(
      and(
        eq(patientInvites.personId, input.personId),
        isNull(patientInvites.redeemedAt),
        isNull(patientInvites.revokedAt),
        gt(patientInvites.expiresAt, now),
      ),
    );

  if (live.length >= 3) {
    return {
      ok: false,
      error: "You have three codes waiting already. Cancel one you are not using.",
    };
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const [row] = await db
        .insert(patientInvites)
        .values({
          personId: input.personId,
          accountId: input.accountId,
          code: mintCode(),
          expiresAt: new Date(
            now.getTime() + (input.minutes ? input.minutes * 60 * 1000 : INVITE_DAYS * 24 * 60 * 60 * 1000),
          ),
        })
        .returning({
          id: patientInvites.id,
          code: patientInvites.code,
          expiresAt: patientInvites.expiresAt,
        });

      await audit({
        actor: null,
        patientAccountId: input.accountId,
        category: "clinical",
        action: "invite.create",
        resourceType: "person",
        resourceId: input.personId,
      });

      return {
        ok: true,
        invite: { ...row!, redeemedAt: null, redeemedBy: null, revokedAt: null },
      };
    } catch (error) {
      if (!String((error as Error).message).includes("patient_invites_code_unique")) throw error;
    }
  }

  return { ok: false, error: "Could not make a code just now. Try again." };
}

/** Cancel one. Scoped to the person, so somebody else's id matches nothing. */
export async function revokeInviteCode(input: {
  personId: string;
  inviteId: string;
}): Promise<{ ok: boolean }> {
  const done = await db
    .update(patientInvites)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(patientInvites.id, input.inviteId),
        eq(patientInvites.personId, input.personId),
        isNull(patientInvites.revokedAt),
        isNull(patientInvites.redeemedAt),
      ),
    )
    .returning({ id: patientInvites.id });

  return { ok: done.length > 0 };
}

export type RedeemResult =
  | { ok: true; patientName: string; waitingOnVerification: boolean }
  | { ok: false; error: string };

/**
 * A clinician redeems a code. 27.2, 27.3, C131.
 *
 * 🔴 This creates a **pending request** and nothing else. It does not read the
 * record, does not name what is in it, and does not tell the clinician
 * anything they could not have learned from the person who handed them the
 * code. What comes back is a first name, so they know the code was not a typo.
 *
 * 27.3 / C131: it works for a clinician who has just signed up and is not
 * verified yet. The request is created, and the **grant cannot activate** until
 * they are approved, which the database enforces (0060) rather than this
 * function. `waitingOnVerification` is how the patient's screen explains why
 * their tap has not taken effect: without it they would approve into silence.
 */
export async function redeemInvite(actor: Actor, code: string): Promise<RedeemResult> {
  const normalised = code.trim().toUpperCase();
  if (!/^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/.test(normalised)) {
    return { ok: false, error: "That is not a code we issue. It is six characters, like ABC-DEF." };
  }

  const now = new Date();

  /*
   * The claim is a conditional UPDATE, so two clinicians racing on one code
   * cannot both win: the loser's WHERE no longer matches.
   */
  const [claimed] = await db
    .update(patientInvites)
    .set({ redeemedByUserId: actor.userId, redeemedAt: now })
    .where(
      and(
        eq(patientInvites.code, normalised),
        isNull(patientInvites.redeemedAt),
        isNull(patientInvites.revokedAt),
        gt(patientInvites.expiresAt, now),
      ),
    )
    .returning({
      id: patientInvites.id,
      personId: patientInvites.personId,
      createdAt: patientInvites.createdAt,
      expiresAt: patientInvites.expiresAt,
    });

  if (!claimed) {
    /* One answer for expired, used, revoked and never issued. */
    return { ok: false, error: "That code is not usable. Ask for a fresh one." };
  }

  const [person] = await db
    .select({ firstName: people.firstName })
    .from(people)
    .where(eq(people.id, claimed.personId))
    .limit(1);

  const [verification] = await db
    .select({ state: therapistVerifications.state })
    .from(therapistVerifications)
    .where(eq(therapistVerifications.userId, actor.userId))
    .limit(1);

  const approved = verification?.state === "approved";

  /*
   * The request. `onConflictDoNothing` on the live partial unique index, so
   * redeeming a code from somebody who already has a request waiting does not
   * fail: there is already exactly the row this would have created.
   */
  /*
   * 🔴 A QR shown in the room (a code that lived an hour or less) asks for 24
   * hours and puts the patient in this therapist's list at once, so they can
   * start a session with them there and then. A code handed over for later
   * asks for open-ended access, as it always did. Either way it only asks.
   */
  const quick = claimed.expiresAt.getTime() - claimed.createdAt.getTime() <= 60 * 60 * 1000;
  await db
    .insert(historyGrants)
    .values({
      personId: claimed.personId,
      therapistUserId: actor.userId,
      organizationId: actor.organizationId,
      status: "pending",
      shape: quick ? "24h" : undefined,
      requestNote: quick
        ? "Invited by you in the room, with the QR code you showed them. For 24 hours."
        : "Invited by you, using a code you gave them.",
      requestedAt: now,
    })
    .onConflictDoNothing();
  if (quick) {
    const { patientRowForPerson } = await import("./people");
    await patientRowForPerson({
      organizationId: actor.organizationId,
      therapistId: actor.userId,
      personId: claimed.personId,
    });
  }

  await audit({
    actor,
    category: "clinical",
    action: "invite.redeem",
    resourceType: "person",
    resourceId: claimed.personId,
  });

  return {
    ok: true,
    patientName: person?.firstName ?? "your patient",
    waitingOnVerification: !approved,
  };
}

/* ------------------------------------------------------ 27.6 · being told */

/**
 * Tell the patient a grant is now live. 27.6, C107.
 *
 * Every new grant, without exception and without a preference to switch off.
 * The threat model is coercion: somebody who was pressured into approving, or
 * whose phone was held while somebody else did, and the only defence a product
 * can offer is that the fact is visible afterwards and revocation costs
 * nothing.
 *
 * The message is deliberately flat. No "great news", no celebration: this is a
 * notice, and if it is a surprise the person reading it needs to notice that
 * rather than skim past a friendly sentence.
 */
export async function notifyPatientOfGrant(input: {
  personId: string;
  therapistUserId: string;
}): Promise<void> {
  const [clinician] = await db
    .select({ firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.id, input.therapistUserId))
    .limit(1);

  const name = fullName(clinician?.firstName, clinician?.lastName, "");

  /*
   * Sent to the patient's own handle rather than written into `notifications`,
   * which hangs off `users` and has no room for somebody who is not a member
   * of an organisation (C41). A patient reads this on their phone, which is
   * also the only place a coerced approval can be noticed afterwards.
   */
  const [account] = await db
    .select({
      email: patientAccounts.email,
      phone: patientAccounts.phone,
      timezone: patientAccounts.timezone,
    })
    .from(patientAccounts)
    .where(eq(patientAccounts.personId, input.personId))
    .limit(1);

  if (!account) return;

  /* 🔴 Ruling 8: in the patient's own language. */
  const { wordsFor } = await import("@/lib/i18n/message-words");
  const { t, locale } = await wordsFor({ personId: input.personId });
  const who = name || t("pmsg.aTherapist");

  const { notify } = await import("@/lib/notify");
  await notify(
    {
      /* So the grant is also on the patient's own list, where it can be undone. */
      personId: input.personId,
      email: account.email,
      phone: account.phone,
      timezone: account.timezone,
      locale,
    },
    {
      notice: { kind: "access_requested", key: "pnotice.accessGranted" },
      kind: "consent.granted",
      subject: t("pmsg.granted.subject"),
      body: t("pmsg.granted.body", { name: who }),
      link: { label: t("pmsg.granted.link"), url: `${env.appUrl}/patient/consent` },
      variables: [who],
    },
  );
}

/* ---------------------------------------------- 27.7 · C108 · asking back */

export type Ask = {
  id: string;
  therapistName: string;
  status: "pending" | "added" | "declined";
  note: string | null;
  declineReason: string | null;
  createdAt: Date;
  answeredAt: Date | null;
};

export async function asksForPerson(personId: string): Promise<Ask[]> {
  const rows = await db
    .select({
      id: historyAsks.id,
      status: historyAsks.status,
      note: historyAsks.note,
      declineReason: historyAsks.declineReason,
      createdAt: historyAsks.createdAt,
      answeredAt: historyAsks.answeredAt,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(historyAsks)
    .innerJoin(users, eq(users.id, historyAsks.therapistUserId))
    .where(eq(historyAsks.personId, personId))
    .orderBy(desc(historyAsks.createdAt))
    .limit(50);

  return rows.map((row) => ({
    id: row.id,
    therapistName: fullName(row.firstName, row.lastName, "A therapist"),
    status: row.status,
    note: row.note,
    declineReason: row.declineReason,
    createdAt: row.createdAt,
    answeredAt: row.answeredAt,
  }));
}

/**
 * The patient asks. 27.7.
 *
 * Only a clinician who has actually seen them: the target is drawn from their
 * own sessions rather than typed, so this cannot become a way to send a
 * message to any clinician on the platform.
 */
export async function askForHistory(input: {
  personId: string;
  accountId: string;
  therapistUserId: string;
  note: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const seen = await db.execute(sql`
    SELECT 1 FROM sessions s
    JOIN patients p ON p.id = s.patient_id
    WHERE p.person_id = ${input.personId} AND s.therapist_id = ${input.therapistUserId}
    LIMIT 1
  `);

  if (seen.rows.length === 0) {
    return { ok: false, error: "You can only ask a therapist you have actually seen." };
  }

  try {
    await db.insert(historyAsks).values({
      personId: input.personId,
      accountId: input.accountId,
      therapistUserId: input.therapistUserId,
      note: input.note?.trim() || null,
    });
  } catch (error) {
    if (String((error as Error).message).includes("history_asks_open_unique")) {
      return { ok: false, error: "You have already asked them. They can see it." };
    }
    throw error;
  }

  const [person] = await db
    .select({ firstName: people.firstName, lastName: people.lastName })
    .from(people)
    .where(eq(people.id, input.personId))
    .limit(1);

  await db.insert(notifications).values({
    userId: input.therapistUserId,
    kind: "system",
    title: `${fullName(person?.firstName, person?.lastName, "A former patient")} has asked you for their history`,
    body: "They would like what you hold added to the record they own. You can add it, or decline, and either way they see your answer. Declining asks you for a reason, which they read.",
    actionUrl: "/patients",
  });

  await audit({
    actor: null,
    patientAccountId: input.accountId,
    category: "clinical",
    action: "history.ask",
    resourceType: "person",
    resourceId: input.personId,
  });

  return { ok: true };
}

/** What a clinician sees in their queue. */
export async function asksForTherapist(therapistUserId: string) {
  return db
    .select({
      id: historyAsks.id,
      status: historyAsks.status,
      note: historyAsks.note,
      createdAt: historyAsks.createdAt,
      personId: historyAsks.personId,
      firstName: people.firstName,
      lastName: people.lastName,
    })
    .from(historyAsks)
    .innerJoin(people, eq(people.id, historyAsks.personId))
    .where(and(eq(historyAsks.therapistUserId, therapistUserId), eq(historyAsks.status, "pending")))
    .orderBy(desc(historyAsks.createdAt))
    .limit(50);
}

/**
 * The clinician answers. 27.7, C108.
 *
 * 🔴 A decline carries a reason, and the database refuses one without. "No"
 * with an explanation is a thing a person can act on; "no" in silence is the
 * outcome the ruling exists to prevent, because the patient cannot tell it
 * apart from being ignored.
 */
export async function answerAsk(
  actor: Actor,
  input: { askId: string; decision: "added" | "declined"; reason?: string },
): Promise<{ ok: boolean; error?: string }> {
  if (input.decision === "declined" && !input.reason?.trim()) {
    return {
      ok: false,
      error: "Say why, in a sentence. They read it, and a silent no is worse than a reason.",
    };
  }

  const [row] = await db
    .update(historyAsks)
    .set({
      status: input.decision,
      declineReason: input.decision === "declined" ? input.reason!.trim() : null,
      answeredAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(historyAsks.id, input.askId),
        eq(historyAsks.therapistUserId, actor.userId),
        eq(historyAsks.status, "pending"),
      ),
    )
    .returning({ personId: historyAsks.personId });

  if (!row) return { ok: false, error: "That request has already been answered." };

  /* The patient hears the answer, including the reason, verbatim (C108). */
  const [account] = await db
    .select({
      email: patientAccounts.email,
      phone: patientAccounts.phone,
      timezone: patientAccounts.timezone,
    })
    .from(patientAccounts)
    .where(eq(patientAccounts.personId, row.personId))
    .limit(1);

  if (account) {
    /* 🔴 Ruling 8: in the patient's own language; their reason goes as written. */
    const { wordsFor } = await import("@/lib/i18n/message-words");
    const { t, locale } = await wordsFor({ personId: row.personId });
    const { notify } = await import("@/lib/notify");
    await notify(
      {
        personId: row.personId,
        email: account.email,
        phone: account.phone,
        timezone: account.timezone,
        locale,
      },
      {
        notice: { kind: "access_requested", key: "pnotice.historyAnswered" },
        kind: "history.answered",
        subject: t(input.decision === "added" ? "pmsg.history.addedSubject" : "pmsg.history.answeredSubject"),
        body:
          input.decision === "added"
            ? t("pmsg.history.added")
            : t("pmsg.history.declined", { reason: input.reason!.trim() }),
        link: { label: t("pmsg.openRecord"), url: `${env.appUrl}/patient/profile` },
        variables: [input.decision === "added" ? "added" : "declined"],
      },
    );
  }

  await audit({
    actor,
    category: "clinical",
    action: `history.ask.${input.decision}`,
    resourceType: "person",
    resourceId: row.personId,
  });

  return { ok: true };
}

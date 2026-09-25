import type { Metadata } from "next";

import { formatMoney } from "@/lib/billing/plans";
import { OpenCarts } from "@/components/admin/open-carts";
import { PendingApprovals } from "@/components/admin/pending-approvals";
import { approvalViews } from "@/lib/billing/approvals";
import { RailExceptions } from "@/components/admin/rail-exceptions";
import { TransferQueue } from "@/components/admin/transfer-queue";
import { PageHeader } from "@/components/ui";
import { ListControls } from "@/components/admin/list-controls";
import { mayOpen } from "@/lib/admin/access";
import { pageOf, paging, searchTerm } from "@/lib/admin/paging";
import { requireStaff } from "@/lib/auth/guard";
import { and, eq, inArray } from "drizzle-orm";

import { openCarts, queue } from "@/lib/billing/manual";
import { openExceptions } from "@/lib/billing/rail-exceptions";
import { controlDb as db } from "@/lib/db";
import { organizations, patientAccounts, patients, sessions, sponsors, users } from "@/lib/db/schema";

export const metadata: Metadata = { title: "Transfers", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The manual rail's queue. PLAN.md 73.2.
 *
 * ## 🔴 `requireStaff`, not `requireRole("super_admin")`
 *
 * This is the opposite ruling from `/admin/financial-model`, and for the
 * opposite reason. A person is sitting on a spinner waiting to join a therapy
 * session, and the whole design of the rail assumes somebody is watching it by
 * the minute. Locking it to the two founders would mean the queue is worked when
 * they are awake, which is not what a person in a crisis at 2am needs.
 *
 * ## 🔴 The queue is oldest first, and that is not a preference
 *
 * Newest first means the person who has waited longest waits longest, forever,
 * whenever the queue is busier than the people working it. Every queue in this
 * product is oldest first for the same reason.
 */
export default async function TransfersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const actor = await requireStaff();
  // W2-A09: the queue is searched by reference or amount, and paged.
  const params = await searchParams;
  const q = searchTerm(params.q);
  const { page, offset, fetch } = paging(params);

  const [fetched, carts, exceptions] = await Promise.all([
    queue({ q, offset, limit: fetch }),
    openCarts(),
    openExceptions(),
  ]);
  const { rows, hasMore } = pageOf(fetched);

  /*
   * 🔴 The payer's NAME, resolved here, because a queue of uuids is a queue
   * nobody can work. Three lookups rather than three joins: the queue is capped
   * at 200 and the alternative is a query with three LEFT JOINs whose result a
   * reader cannot check by eye.
   */
  /*
   * 🔴 76.15 — BOTH LISTS RESOLVE THEIR NAMES FROM ONE LOOKUP.
   *
   * The open carts and the submitted queue are different questions with the
   * same payers behind them, and two sets of three queries would be six round
   * trips to answer one screen.
   */
  const everyRow = [...rows, ...carts, ...exceptions];
  const userIds = everyRow.map((r) => r.userId).filter((x): x is string => Boolean(x));
  const patientIds = everyRow
    .map((r) => r.patientAccountId)
    .filter((x): x is string => Boolean(x));
  const sponsorIds = everyRow.map((r) => r.sponsorId).filter((x): x is string => Boolean(x));
  /* 0150 — a practice paying its own bill carries only its organisation. */
  const practiceIds = everyRow
    .filter((r) => r.payerKind === "organization" && r.organizationId)
    .map((r) => r.organizationId as string);
  /*
   * A guest or patient paying for one session carries only the session, so
   * the name comes through it. They read "A company" before (live walkthrough),
   * the fallback at the end of `nameFor`.
   */
  const sessionIds = everyRow
    .filter((r) => r.payerKind === "session" && r.refId)
    .map((r) => r.refId as string);
  const sessionPayers =
    sessionIds.length > 0
      ? await db
          .select({
            id: sessions.id,
            guestName: sessions.guestName,
            firstName: patients.firstName,
            lastName: patients.lastName,
          })
          .from(sessions)
          .leftJoin(patients, eq(patients.id, sessions.patientId))
          .where(inArray(sessions.id, sessionIds))
      : [];
  const practices =
    practiceIds.length > 0
      ? await db
          .select({ id: organizations.id, name: organizations.name })
          .from(organizations)
          .where(inArray(organizations.id, practiceIds))
      : [];

  /*
   * ⚠️ 76.11 — THESE THREE HAD NO `WHERE` AND READ THE WHOLE TABLE.
   *
   * The ids were collected three lines up and then not used: each select
   * pulled every user, every patient account and every sponsor in the
   * database, and `nameFor` searched the result in memory. Correct output,
   * and a query that grows with the product rather than with the queue.
   */
  const [people, accounts, orgs] = await Promise.all([
    userIds.length > 0
      ? db
          .select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            organizationId: users.organizationId,
          })
          .from(users)
          .where(inArray(users.id, userIds))
      : Promise.resolve([]),
    patientIds.length > 0
      ? db
          .select({ id: patientAccounts.id, email: patientAccounts.email })
          .from(patientAccounts)
          .where(inArray(patientAccounts.id, patientIds))
      : Promise.resolve([]),
    sponsorIds.length > 0
      ? db
          .select({ id: sponsors.id, name: sponsors.name })
          .from(sponsors)
          .where(inArray(sponsors.id, sponsorIds))
      : Promise.resolve([]),
  ]);

  /*
   * 🔴 76.11 — HOW MANY CLINICIANS EACH PAYING PRACTICE HAS, which is what
   * separates a therapist from a clinic. The same question the billing screen
   * asks of the seat bill, asked here of the roster because this queue has no
   * subscription in hand.
   */
  const payingOrgIds = [
    ...new Set(people.map((p) => p.organizationId).filter((x): x is string => Boolean(x))),
  ];
  const rosters = payingOrgIds.length > 0
    ? await db
        .select({ organizationId: users.organizationId, id: users.id })
        .from(users)
        .where(and(inArray(users.organizationId, payingOrgIds), eq(users.role, "therapist")))
    : [];
  const clinicianCount = (orgId: string | null) =>
    orgId ? rosters.filter((r) => r.organizationId === orgId).length : 0;

  /*
   * 🔴 76.11 — WHICH KIND OF PAYER THIS IS, from the column that identifies them.
   *
   * The payer columns are mutually exclusive by CHECK constraint
   * (`manual_payments_one_payer`), so this is a read rather than a guess. A
   * clinician paying under a practice with more than one clinician is billed as
   * a clinic, which is the same rule `manualEntry` applies when it chooses
   * which heading to show them.
   */
  /**
   * 🔴 76.57 — IS THERE A RECEIPT, AND IS IT A PDF. Nothing else crosses over.
   *
   * `lib/uploads.ts` puts the extension in the stored path, so this is a read
   * of the name rather than a fetch. A file with no extension at all is treated
   * as an image, which renders as a broken picture the modal reports out loud
   * rather than as an absent one the operator would confirm around.
   */
  const proofKindOf = (url: string | null): "image" | "pdf" | null => {
    if (!url) return null;
    return url.split("?")[0]!.toLowerCase().endsWith(".pdf") ? "pdf" : "image";
  };

  const typeFor = (row: (typeof rows)[number]): "patient" | "therapist" | "clinic" | "company" => {
    if (row.sponsorId) return "company";
    if (row.payerKind === "organization") return "clinic";
    if (row.userId) {
      const u = people.find((p) => p.id === row.userId);
      return clinicianCount(u?.organizationId ?? null) > 1 ? "clinic" : "therapist";
    }
    return "patient";
  };

  /*
   * 🔴 Where an operator goes to see the rest of the story, and null when there
   * is nowhere to go. A guest paying for a session has no account at all, which
   * is the whole point of the `session` payer kind: asking somebody to sign up
   * before a crisis session would be the wrong trade.
   */
  const profileFor = (row: (typeof rows)[number]): string | null => {
    const href = row.sponsorId
      ? `/admin/sponsors/${row.sponsorId}`
      : row.userId
        ? `/admin/therapists/${row.userId}`
        : row.patientAccountId
          ? `/admin/patients/${row.patientAccountId}`
          : null;
    // W2-A01: a clinician's page is the owner's, so staff get the name without a link that bounces.
    return href && mayOpen(actor.role, href) ? href : null;
  };

  const nameFor = (row: (typeof rows)[number]): string => {
    if (row.payerKind === "organization") {
      return practices.find((p) => p.id === row.organizationId)?.name ?? "A practice";
    }
    if (row.userId) {
      const u = people.find((p) => p.id === row.userId);
      return u ? `${u.firstName} ${u.lastName}` : "A clinician";
    }
    if (row.patientAccountId) {
      const a = accounts.find((p) => p.id === row.patientAccountId);
      return a?.email ?? "A patient";
    }
    if (row.payerKind === "session") {
      const s = sessionPayers.find((p) => p.id === row.refId);
      const name = [s?.firstName, s?.lastName].filter(Boolean).join(" ") || s?.guestName;
      return name || "A patient";
    }
    const s = orgs.find((p) => p.id === row.sponsorId);
    return s?.name ?? "A company";
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Transfers"
        subtitle="Bank transfers waiting to be checked."
      />
      {/* 🔴 0161 / ruling 13c: a transfer confirmed without proof waits here for a second person. */}
      <PendingApprovals rows={await approvalViews("transfer_without_proof", actor.userId)} />
      {/*
        🔴 76.15 — under the queue, collapsed, and never above it. The queue is
        people waiting on us; this is a reference an operator opens when a bank
        line will not match anything in it.
      */}
      <ListControls base="/admin/transfers" params={{}} q={q} page={page} hasMore={hasMore} />

      <TransferQueue
        rows={rows.map((r) => ({
          id: r.id,
          purpose: r.purpose,
          amountCents: r.amountCents,
          currency: r.currency,
          /*
           * 🔴 76.28 — WRITTEN OUT HERE, because the queue is a client
           * component and C84 bans `Intl` in one. It printed a company's
           * top-up as "5700000.00 EGP", which is unreadable at the one moment
           * it matters: an operator comparing it with a line in a banking app.
           */
          amountLabel: formatMoney(r.amountCents, r.currency.toUpperCase(), "en-US"),
          settlesCents: r.settlesCents,
          reference: r.reference,
          /*
           * 🔴 76.57 — THE KIND, NOT THE ADDRESS.
           *
           * This passed `proofUrl` — the unguessable blob URL — into a client
           * component for every row in the queue. Nothing rendered it, which is
           * why it survived; it still put the storage address of a photograph
           * of somebody's banking app into the page source, where a read could
           * be taken that `/admin/transfers/receipt/[id]` never sees and the
           * audit log never records. The screen needs to know whether there is
           * one and whether it is a PDF, and neither of those is a URL.
           */
          proofKind: proofKindOf(r.proofUrl),
          submittedAt: r.submittedAt?.toISOString() ?? null,
          /*
           * The wait, counted HERE: counted in the client component it was a
           * different minute on the server pass and in the browser, and React
           * threw #418 on the live queue (walkthrough).
           */
          waitedMinutes: r.submittedAt ? Math.round((Date.now() - r.submittedAt.getTime()) / 60000) : null,
          payer: nameFor(r),
          payerType: typeFor(r),
          profileHref: profileFor(r),
          /* 🔴 76.16 — what the payer said it covers. Absent on older rows. */
          lines: r.lineItems ?? [],
        }))}
      />

      {/* 🔴 W2-A03 / A4: money we hold that somebody has to decide about. */}
      <RailExceptions
        rows={exceptions.map((e) => ({
          id: e.id,
          payer: nameFor(e),
          what: e.purpose,
          amountLabel: formatMoney(e.amountCents, e.currency.toUpperCase(), "en-US"),
          settlesCents: e.settlesCents,
          kind: e.exception!,
          detail: e.exceptionDetail,
          raisedAt: e.exceptionAt?.toISOString() ?? null,
        }))}
      />

      <OpenCarts
        rows={carts.map((c) => ({
          id: c.id,
          payer: nameFor(c),
          payerType: typeFor(c),
          what: c.purpose,
          amountLabel: formatMoney(c.amountCents, c.currency.toUpperCase(), "en-US"),
          settlesCents: c.settlesCents,
          openedAt: c.createdAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}

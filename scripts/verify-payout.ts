/**
 * 🔴 76.57 — MONEY OUT, END TO END, AGAINST A REAL DATABASE.
 *
 *     npm run verify:payout
 *
 * ## Why this did not exist and should have
 *
 * Every other rail in this product has a verifier. Money OUT had none. It is
 * the rail with the fewest safety nets in it: there is no card network, no
 * processor, no chargeback and no reconciliation file. A clinician asks for
 * their held earnings, a person reads it, a person approves it, a person makes
 * a bank transfer by hand and uploads a photograph of having done so. If any
 * one of those steps is wrong, the only thing that notices is a clinician who
 * is owed money and has not been paid.
 *
 * ## 🔴 THE FOUR REFUSALS ARE THE POINT, NOT THE HAPPY PATH
 *
 * A payout that works proves the buttons are wired. What this checks is what
 * the rail REFUSES, because every one of those refusals is somebody's money:
 *
 *   - more than is actually held;
 *   - a second request while one is in flight;
 *   - a clinician approving their own;
 *   - marking one sent with no receipt attached.
 *
 * Each has a planted offender. A check that only ever sees a valid request
 * proves the valid path and nothing about the invalid one, which is the §6
 * family this repository keeps finding.
 *
 * ## And the one that is not about payouts at all
 *
 * 🔴 **A transfer receipt cannot be deleted.** Before 76.57 that was true
 * because nothing happened to call `deleteDocument` on one, which is a fact
 * about four call sites rather than a property of the system. It is a rule now
 * and this plants the attempt and watches it refuse, in both directions: a
 * receipt is refused, and an onboarding document is still deleted, because a
 * guard that refused everything would pass this check while breaking the
 * product.
 *
 * ## It refuses production
 *
 * `writesTo()` with no argument. It plants an organisation, a clinician, held
 * earnings and a payout request, and deletes all of it in a `finally`.
 */
import { sql } from "drizzle-orm";

import { reporter, writesTo } from "./_verify";
import { connect } from "./db";
import { setRulesForThisCheck, TWO_PEOPLE_EVERYWHERE } from "./_rules";

const { check, finish } = reporter();

const SLUG = "verify-payout-example";

async function main() {
  writesTo();

  const { pool, db } = connect();

  let orgId: string | null = null;
  let therapistId: string | null = null;
  let approverId: string | null = null;
  let senderId: string | null = null;

  try {
    const { requestPayout, approvePayout, markPayoutSent, rejectPayout } = await import(
      "../lib/billing/payouts"
    );
    const { isUndeletable, deleteDocument } = await import("../lib/uploads");
    const { hashPassword } = await import("../lib/auth/password");

    /*
     * 🔴 SWEEP FIRST. A run that died half way leaves an organisation behind,
     * and the next run then fails on a unique slug and reports itself as broken
     * rather than reporting the code. Same lesson as `verify:actuals`.
     */
    await sweep(db);

    /* ------------------------------------------------------- plant a rail -- */

    const made = await db.execute<{ id: string }>(sql`
      INSERT INTO organizations (name, slug, kind)
      VALUES ('Verify Payout Example', ${SLUG}, 'solo') RETURNING id`);
    orgId = made.rows[0]!.id;

    const hash = await hashPassword("VerifyPayout2026!");

    const clinician = await db.execute<{ id: string }>(sql`
      INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role)
      VALUES (${orgId}, 'payout.example@example.com', ${hash}, 'Payout', 'Example', 'therapist')
      RETURNING id`);
    therapistId = clinician.rows[0]!.id;

    const staff = await db.execute<{ id: string }>(sql`
      INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role)
      VALUES (${orgId}, 'payout.approver@example.com', ${hash}, 'Approver', 'Example', 'super_admin')
      RETURNING id`);
    approverId = staff.rows[0]!.id;
    /* 🔴 Four eyes on every payout: a second person sends what the first approved. */
    const sender = await db.execute<{ id: string }>(sql`
      INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role)
      VALUES (${orgId}, 'payout.sender@example.com', ${hash}, 'Sender', 'Example', 'super_admin')
      RETURNING id`);
    senderId = sender.rows[0]!.id;

    /*
     * $100 of held earnings, as a credit to `therapist_payable`, which is how
     * the ledger records money we owe a clinician. Balanced against cash so a
     * trial balance would still pass over it.
     */
    const txn = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO ledger_entries (txn_id, txn_kind, account, organization_id, user_id,
                                  amount_cents, ref_type, memo)
      VALUES
        (${txn}, 'session_payment', 'cash',              ${orgId}, NULL,           10000, 'session_payment', 'verify: money in'),
        (${txn}, 'session_payment', 'therapist_payable', ${orgId}, ${therapistId}, -10000, 'session_payment', 'verify: owed out')`);

    await db.execute(sql`
      INSERT INTO payout_methods (therapist_id, organization_id, method, identifier,
                                  account_name, is_default)
      VALUES (${therapistId}, ${orgId}, 'instapay', 'payout.example@instapay',
              'Payout Example', true)`);

    /* ------------------------------------------------- refusal 1: too much -- */

    const tooMuch = await requestPayout({
      therapistId,
      organizationId: orgId,
      amountCents: 20_000,
    });

    check(
      "🔴 a clinician cannot withdraw more than is actually held",
      Boolean(tooMuch.error) && !tooMuch.id,
      tooMuch.error ?? "it was ALLOWED, and $100 of held earnings just paid out $200",
    );

    /* ------------------------------------------------- the request itself -- */

    const asked = await requestPayout({
      therapistId,
      organizationId: orgId,
      amountCents: 6_000,
    });

    check(
      "🔴 CONTROL …and a request WITHIN what is held goes through",
      Boolean(asked.id) && !asked.error,
      asked.id
        ? `$60 of $100 held, request ${asked.id.slice(0, 8)}`
        : `refused: ${asked.error ?? "no reason"}. The refusal above proves nothing if this fails`,
    );

    if (!asked.id) throw new Error("no payout request to carry on with");
    const requestId = asked.id;

    /* ----------------------------------------- refusal 2: a second request -- */

    const again = await requestPayout({
      therapistId,
      organizationId: orgId,
      amountCents: 1_000,
    });

    check(
      "🔴 a second withdrawal while one is in flight is refused",
      Boolean(again.error) && !again.id,
      again.error ?? "TWO open requests against one balance, which is how it gets paid twice",
    );

    /* ------------------------------- refusal 3: approving one's own payout -- */

    const ownApproval = await approvePayout({ requestId, approverUserId: therapistId });

    check(
      "🔴 a clinician cannot approve their own payout",
      Boolean(ownApproval.error),
      ownApproval.error ?? "it was ALLOWED. One person asked for the money and released it",
    );

    /* ------------------------------------ refusal 4: sent with no evidence -- */

    const noProof = await markPayoutSent({
      requestId,
      senderUserId: senderId!,
      proofUrl: "",
    });

    check(
      "🔴 a payout cannot be marked sent with no receipt attached",
      Boolean(noProof.error),
      noProof.error ?? "marked sent with nothing to show. That is the state a dispute cannot be settled from",
    );

    /*
     * 🔴 THE BALANCE MOVES AFTER THE REQUEST (live walkthrough: $255 approved
     * against $51 held on production). $50 of the $100 leaves the balance by an
     * adjustment, so the $60 request is now more than we hold: approval is
     * refused. Then the adjustment is taken back, and the approval below is the
     * control that the refusal was about the balance.
     */
    const drop = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO ledger_entries (txn_id, txn_kind, account, organization_id, user_id,
                                  amount_cents, ref_type, memo)
      VALUES
        (${drop}, 'adjustment', 'therapist_payable', ${orgId}, ${therapistId}, 5000, 'adjustment', 'verify: balance moved'),
        (${drop}, 'adjustment', 'cash',              ${orgId}, NULL,           -5000, 'adjustment', 'verify: balance moved')`);
    const overHeld = await approvePayout({ requestId, approverUserId: approverId });
    check(
      "🔴 a request the balance no longer covers cannot be approved, whatever it was when it was asked",
      Boolean(overHeld.error) && !overHeld.ok,
      overHeld.error ?? "APPROVED $60 against $50 held",
    );
    await db.execute(sql`DELETE FROM ledger_entries WHERE txn_id = ${drop}`);

    /* -------------------------------------------------- the whole way out -- */

    const approved = await approvePayout({ requestId, approverUserId: approverId });

    check(
      "🔴 CONTROL a DIFFERENT person can approve it, so the refusal above is about the person",
      Boolean(approved.ok) && !approved.error,
      approved.error ?? "approved by somebody who is not the clinician",
    );

    /*
     * 🔴 A19: FIVE CHARACTERS OF ANYTHING WAS A RECEIPT. Asked of an APPROVED
     * payout by a second person, so the only thing that can refuse it is the
     * receipt rule: before the fix `done!` sent the money.
     */
    const { plausibleTransferReceipt } = await import("../lib/billing/transfer-receipt");
    const junk = await markPayoutSent({ requestId, senderUserId: senderId!, proofUrl: "done!" });
    const stillApproved = (
      await db.execute<{ status: string }>(sql`SELECT status FROM payout_requests WHERE id = ${requestId}`)
    ).rows[0];
    check(
      "🔴 A19 an approved payout cannot be marked sent with five characters that are no bank reference",
      Boolean(junk.error) && stillApproved?.status === "approved",
      junk.error ?? `ACCEPTED, status ${stillApproved?.status}`,
    );
    const shapes = {
      refused: ["sent.", "12345", "000000", "paid by me", "http://bank.example/r", "javascript:alert(1)"],
      accepted: ["CIB-TRX-4471902", "INSTA-99231", "NBE/2026/88120", "https://bank.example/r/1", "/api/uploads/receipt/x.png"],
    };
    const wrong = [
      ...shapes.refused.filter((text) => plausibleTransferReceipt(text)),
      ...shapes.accepted.filter((text) => !plausibleTransferReceipt(text)),
    ];
    check(
      "🔴 A19 CONTROL a real bank reference and a receipt link still pass, so the rule refuses junk rather than everything",
      wrong.length === 0,
      wrong.length === 0 ? `${shapes.refused.length} refused, ${shapes.accepted.length} accepted` : `misjudged: ${wrong.join(" | ")}`,
    );

    /*
     * 🔴 W1-04: TWO PRESSES AT ONCE. Two people on the queue, or one double
     * click, both reach "Mark sent". The ledger used to be posted before the
     * guarded status move, so both calls posted and one payout left the books
     * twice. Exactly one call may win, and only the winner posts.
     */
    const both = await Promise.all(
      [0, 1].map(() =>
        markPayoutSent({
          requestId,
          senderUserId: senderId!,
          proofUrl: "/api/uploads/receipt/verify/payout-proof.png",
        }),
      ),
    );
    const sent = both.find((result) => result.ok) ?? both[0]!;

    check(
      "🔴 …and WITH a receipt it goes out, which is what makes refusal 4 a rule rather than a bug",
      Boolean(sent.ok) && !sent.error,
      sent.error ?? "stamped, with the receipt on the row",
    );

    const posted = await db.execute<{ txns: string }>(sql`
      SELECT COUNT(DISTINCT txn_id)::text AS txns
        FROM ledger_entries
       WHERE txn_kind = 'manual_payout' AND ref_id = ${requestId}`);

    check(
      "🔴 two concurrent sends post ONE ledger transaction",
      Number(posted.rows[0]?.txns ?? 0) === 1 && both.filter((result) => result.ok).length === 1,
      `${posted.rows[0]?.txns ?? 0} ledger transactions, ${both.filter((result) => result.ok).length} calls reported success`,
    );

    /*
     * 🔴 THE MONEY ACTUALLY MOVED IN THE LEDGER, which is the half a status
     * column cannot tell you. A request that reads `sent` over a ledger that
     * still owes the clinician $100 is the worst state this rail has, because
     * every screen agrees with itself and the balance is wrong.
     */
    const owed = await db.execute<{ cents: string }>(sql`
      SELECT COALESCE(-SUM(amount_cents), 0)::text AS cents
        FROM ledger_entries
       WHERE account = 'therapist_payable' AND user_id = ${therapistId}`);

    check(
      "🔴 the LEDGER moved, not just the status column",
      Number(owed.rows[0]?.cents ?? 0) === 4_000,
      `$${(Number(owed.rows[0]?.cents ?? 0) / 100).toFixed(2)} still owed after a $60 payout ` +
        "against $100 held. Expected $40.00",
    );

    const stamped = await db.execute<{ status: string; proof_url: string | null }>(sql`
      SELECT status, proof_url FROM payout_requests WHERE id = ${requestId}`);

    check(
      "🔴 …and the row carries the evidence, so a dispute has something to read",
      stamped.rows[0]?.status === "sent" && Boolean(stamped.rows[0]?.proof_url),
      `status ${stamped.rows[0]?.status ?? "gone"}, receipt ${stamped.rows[0]?.proof_url ? "on the row" : "MISSING"}`,
    );

    /*
     * 🔴 W2-A04 (needs 0140): IT DID NOT ARRIVE. Two presses at once, like the
     * send above: one move wins, one reversal posts, and the clinician is
     * owed the whole $100 again.
     */
    const { markPayoutReturned } = await import("../lib/billing/payouts");
    const noWhy = await markPayoutReturned({ requestId, actorUserId: approverId!, reason: " " });
    check(
      "🔴 W2-A04 'did not arrive' with no reason is refused",
      Boolean(noWhy.error),
      noWhy.error ?? "reversed with nothing for the clinician to read",
    );
    /* 🔴 K23: nine characters passed the old five-character floor and reversed the payout. */
    const nineWhy = await markPayoutReturned({ requestId, actorUserId: approverId!, reason: "Bounced!!" });
    check(
      "🔴 K23 'did not arrive' with a nine character reason is refused, at the console's ten",
      nineWhy.error === "aconfirm.tooShort",
      JSON.stringify(nineWhy),
    );

    const returned = await Promise.all(
      [0, 1].map(() =>
        markPayoutReturned({
          requestId,
          actorUserId: approverId!,
          reason: "The wallet provider bounced the transfer.",
        }),
      ),
    );
    const reversals = await db.execute<{ txns: string }>(sql`
      SELECT COUNT(DISTINCT txn_id)::text AS txns
        FROM ledger_entries
       WHERE txn_kind = 'manual_payout_returned' AND ref_id = ${requestId}`);
    check(
      "🔴 W2-A04 two concurrent 'did not arrive' presses reverse the ledger ONCE",
      Number(reversals.rows[0]?.txns ?? 0) === 1 && returned.filter((r) => r.ok).length === 1,
      `${reversals.rows[0]?.txns ?? 0} reversals, ${returned.filter((r) => r.ok).length} calls reported success`,
    );

    const owedAgain = await db.execute<{ cents: string }>(sql`
      SELECT COALESCE(-SUM(amount_cents), 0)::text AS cents
        FROM ledger_entries
       WHERE account = 'therapist_payable' AND user_id = ${therapistId}`);
    const back = await db.execute<{ status: string }>(sql`
      SELECT status FROM payout_requests WHERE id = ${requestId}`);
    check(
      "🔴 W2-A04 …and the clinician is owed the whole $100 again, on a row that says returned",
      Number(owedAgain.rows[0]?.cents ?? 0) === 10_000 && back.rows[0]?.status === "returned",
      `$${(Number(owedAgain.rows[0]?.cents ?? 0) / 100).toFixed(2)} owed, status ${back.rows[0]?.status ?? "gone"}`,
    );

    /* ------------------------------------------------ a rejection needs why */

    const noReason = await rejectPayout({
      requestId,
      actorUserId: approverId,
      reason: "  ",
    });

    check(
      "🔴 a rejection with no sentence in it is refused",
      Boolean(noReason.error),
      noReason.error ?? "rejected with no reason, which looks like an answer and is not one",
    );
    const nineReject = await rejectPayout({ requestId, actorUserId: approverId, reason: "Wrong acc" });
    check(
      "🔴 K23 a rejection with a nine character reason is refused for its length, before anything else is read",
      nineReject.error === "aconfirm.tooShort",
      JSON.stringify(nineReject),
    );

    /* -------------------------------------- a receipt cannot be deleted -- */

    const receipt = "/api/uploads/receipt/some-user/proof-abc123.png";
    const notAReceipt = "/api/uploads/document/some-user/licence-abc123.png";

    check(
      "🔴 a transfer receipt is undeletable by rule, not because nothing happens to call it",
      isUndeletable(receipt),
      isUndeletable(receipt)
        ? "receipt/ is on the list, and a fifth call site cannot quietly remove the evidence"
        : "a receipt would be deleted. It is the only proof the payment was ever made",
    );

    check(
      "🔴 CONTROL …and an onboarding document is still deletable, or the guard breaks the product",
      !isUndeletable(notAReceipt),
      !isUndeletable(notAReceipt)
        ? "a licence being replaced still goes, which is what `deleteDocument` is for"
        : "EVERYTHING is refused, so the check above passes by refusing all files",
    );

    let threw = false;
    try {
      await deleteDocument(receipt);
    } catch {
      threw = true;
    }

    check(
      "🔴 …and the call THROWS rather than returning quietly, so the bug cannot ship",
      threw,
      threw
        ? "deleteDocument refused a receipt out loud"
        : "it returned success. A caller deleting the evidence would never find out",
    );
  } finally {
    await sweep(db);
    await pool.end();
  }

  finish("sprint 76 payout");
}

async function sweep(db: ReturnType<typeof connect>["db"]): Promise<void> {
  await db.execute(sql`
    DELETE FROM payout_requests WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug = ${SLUG})`);
  await db.execute(sql`
    DELETE FROM payout_methods WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug = ${SLUG})`);
  await db.execute(sql`
    DELETE FROM ledger_entries WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug = ${SLUG})`);
  await db.execute(sql`
    DELETE FROM audit_log WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug = ${SLUG})`);
  await db.execute(sql`
    DELETE FROM users WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug = ${SLUG})`);
  await db.execute(sql`DELETE FROM organizations WHERE slug = ${SLUG}`);
}

/* 🔴 0161: these checks were written for two people on every queue, so they say so. */
setRulesForThisCheck(TWO_PEOPLE_EVERYWHERE);

main();

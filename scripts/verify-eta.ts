/**
 * 🔴 0147 / 0148: EVERY COMPANY TOP-UP GETS A TAX INVOICE, EVERY RETURN A CREDIT NOTE.
 *
 * On the ETA simulator, which refuses what the Tax Authority refuses outright
 * (unsigned, a signature over other text, totals that do not add up, a bad
 * receiver number, an internal id twice). So what this proves is the product
 * around the client: the day `ETA_MODE=preprod`, the same code certifies.
 *
 *   waiting     on our configuration, then on our own details, then on the
 *               company's, each saying which; a bad tax number refused
 *   issued      on save, validated, the PDF to its company and to nobody else
 *   refused     unsigned, forged, a duplicate internal id
 *   returns     four eyes, the pot and the ledger fall together, the spend
 *               does not move, the credit note names the invoice; more than
 *               the pot, and a second open request, refused; a credit note
 *               larger than what was invoiced waits
 *   readiness   the simulator refused on the live deployment; preprod asks
 *               for its credentials
 */
import { sql } from "drizzle-orm";

import { reporter, required, writesTo } from "./_verify";
import { connect } from "./db";

const { check, finish } = reporter();
const fixture = `eta-${Date.now().toString(36)}`;
type Db = ReturnType<typeof connect>["db"];

async function one<T>(db: Db, text: ReturnType<typeof sql>): Promise<T> {
  return required((await db.execute(text)).rows[0] as T | undefined, "a planted row");
}

async function main() {
  writesTo();
  const { pool, db } = connect();
  const { env } = await import("../lib/env");
  const saved = { mode: env.etaMode, signer: env.etaSigner, live: env.liveDeployment, id: env.etaClientId };
  Object.assign(env, { etaMode: "", etaSigner: "" });

  const { getSettings, writeSettingsGroup } = await import("../lib/settings");
  const invoiceBefore = (await getSettings()).invoice;

  const org = await one<{ id: string }>(db, sql`
    INSERT INTO organizations (name, region, slug) VALUES ('ETA Demo Ops', 'eg', ${fixture}) RETURNING id`);
  const opA = await one<{ id: string }>(db, sql`
    INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash)
    VALUES (${org.id}, ${`ops.a.${fixture}@example.com`}, 'Ops', 'A', 'super_admin', 'x') RETURNING id`);
  const opB = await one<{ id: string }>(db, sql`
    INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash)
    VALUES (${org.id}, ${`ops.b.${fixture}@example.com`}, 'Ops', 'B', 'super_admin', 'x') RETURNING id`);
  const sponsor = await one<{ id: string }>(db, sql`
    INSERT INTO sponsors (name, kind, entity, currency, state)
    VALUES (${`ETA Demo Foundry ${fixture}`}, 'company', 'eg', 'EGP', 'active') RETURNING id`);
  const other = await one<{ id: string }>(db, sql`
    INSERT INTO sponsors (name, kind, entity, currency, state)
    VALUES (${`ETA Other Co ${fixture}`}, 'company', 'eg', 'EGP', 'active') RETURNING id`);

  try {
    const { openCart } = await import("../lib/billing/cart");
    const { submitProof, confirmPayment, egpMinorFor, egpRateMicro } = await import("../lib/billing/manual");
    const { grantFor } = await import("../lib/billing/manual-grants");
    const { potTopUpMoney, entityVatBps, ledgerPotBalance, potTotals } = await import("../lib/billing/pot");
    const { openPot } = await import("../lib/data/sponsor-admin");
    const { advanceEtaDocuments, printoutFor, documentsFor } = await import("../lib/billing/eta/issue");
    const { saveCompanyTaxDetails } = await import("../lib/billing/eta/company");
    const { whatEtaNeeds } = await import("../lib/billing/eta");
    const { FAKE_ETA, FAKE_SIGNER } = await import("../lib/billing/eta/fake");
    const { buildEtaDocument } = await import("../lib/billing/eta/document");
    const { serializeEta, toEtaJson } = await import("../lib/billing/eta/serialize");
    const { requestPotReturn, sendPotReturn } = await import("../lib/billing/pot-return");
    const rate = await egpRateMicro();

    const docs = async (sponsorId = sponsor.id) =>
      (await db.execute(sql`
        SELECT id, kind, state, waiting_for, error, eta_uuid, document_text, total_minor
          FROM eta_documents WHERE sponsor_id = ${sponsorId} ORDER BY created_at`)).rows as {
        id: string; kind: string; state: string; waiting_for: string | null; error: string | null;
        eta_uuid: string | null; document_text: string | null; total_minor: number;
      }[];

    /* ------------------------------------------------------------ a top-up */
    await openPot({
      sponsorId: sponsor.id,
      refundPolicy: "Unused balance is refunded within 30 days of written notice.",
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      overdraftCents: 0,
      welcomeCreditCents: 0,
    });
    const topUp = potTopUpMoney({ creditCents: 20_000, vatBps: await entityVatBps("eg") });
    const cart = await openCart({
      purpose: "pot_topup",
      refId: sponsor.id,
      amountCents: egpMinorFor(topUp.settlesCents, rate),
      settlesCents: topUp.settlesCents,
      lineItems: [{ label: "Pot credit", cents: topUp.creditCents }],
      payer: { kind: "sponsor", sponsorId: sponsor.id },
    });
    await submitProof({ paymentId: cart.id!, reference: `M-ETA-${fixture}`, proofUrl: null });
    await confirmPayment({ paymentId: cart.id!, byUserId: opA.id, onConfirmed: grantFor });

    let [invoice] = await docs();
    check(
      "🔴 0147 a confirmed top-up opens its invoice at once, for the pounds that arrived, and with ETA off it waits on configuration",
      invoice?.kind === "invoice" && invoice.state === "waiting" &&
        (invoice.waiting_for ?? "").startsWith("configuration") &&
        Number(invoice.total_minor) === egpMinorFor(topUp.settlesCents, rate),
      JSON.stringify(invoice),
    );

    Object.assign(env, { etaMode: "fake", etaSigner: "fake" });
    await writeSettingsGroup({
      group: "invoice",
      value: {
        ...invoiceBefore,
        entities: [
          ...invoiceBefore.entities.filter((e) => e.entity !== "eg"),
          { entity: "eg", legalName: "", address: "", taxId: "", numberPrefix: "EG" },
        ],
      },
      updatedBy: opA.id,
    });
    await advanceEtaDocuments();
    [invoice] = await docs();
    check(
      "🔴 0147 with the simulator on and our own details missing, it waits on ours and says so",
      invoice.state === "waiting" && (invoice.waiting_for ?? "").startsWith("our details"),
      invoice.waiting_for ?? "",
    );

    await writeSettingsGroup({
      group: "invoice",
      value: {
        ...invoiceBefore,
        entities: [
          ...invoiceBefore.entities.filter((e) => e.entity !== "eg"),
          {
            entity: "eg",
            legalName: "Demo Therapy Egypt LLC",
            address: "1 Demo Street, Cairo",
            taxId: "100200300",
            numberPrefix: "EG",
            eta: {
              activityCode: "8690",
              branchId: "0",
              governate: "Cairo",
              regionCity: "Nasr City",
              street: "Demo Street",
              buildingNumber: "1",
              itemCode: "EG-100200300-1",
            },
          },
        ],
      },
      updatedBy: opA.id,
    });
    await advanceEtaDocuments();
    [invoice] = await docs();
    check(
      "🔴 0147 with ours in place, it waits on the company's tax details",
      invoice.state === "waiting" && (invoice.waiting_for ?? "").startsWith("company details"),
      invoice.waiting_for ?? "",
    );

    const bad = await saveCompanyTaxDetails({
      sponsorId: sponsor.id, legalName: "ETA Demo Foundry SAE", taxRegistrationNumber: "12345",
      governate: "Giza", regionCity: "6th of October", street: "Industrial Zone 2", buildingNumber: "14",
    });
    const noAddress = await saveCompanyTaxDetails({
      sponsorId: sponsor.id, legalName: "ETA Demo Foundry SAE", taxRegistrationNumber: "987654321",
      governate: "Giza", regionCity: "", street: "Industrial Zone 2", buildingNumber: "14",
    });
    check(
      "🔴 0147 a tax number that is not 9 digits, and an address with a gap, are refused in the reader's words",
      "error" in bad && bad.error === "sponsor.tax.errRin" && "error" in noAddress && noAddress.error === "sponsor.tax.errAddress",
      JSON.stringify({ bad, noAddress }),
    );

    await saveCompanyTaxDetails({
      sponsorId: sponsor.id, legalName: "ETA Demo Foundry SAE", taxRegistrationNumber: "987 654 321",
      governate: "Giza", regionCity: "6th of October", street: "Industrial Zone 2", buildingNumber: "14",
    });
    [invoice] = await docs();
    const sent = JSON.parse(invoice.document_text ?? "{}") as {
      receiver?: { id?: string }; documentType?: string; signatures?: { value: string }[];
    };
    check(
      "🔴 0147 saving the company's details issues what waited for them: validated, to the right receiver, signed",
      invoice.state === "valid" && Boolean(invoice.eta_uuid) && sent.receiver?.id === "987654321" &&
        sent.documentType === "I" && Boolean(sent.signatures?.[0]?.value),
      JSON.stringify({ state: invoice.state, error: invoice.error, receiver: sent.receiver }),
    );

    const pdf = await printoutFor(sponsor.id, invoice.id);
    const borrowed = await printoutFor(other.id, invoice.id);
    check(
      "🔴 0147 the official PDF to its own company, and nothing to another company holding the id",
      pdf !== null && pdf.byteLength > 0 && borrowed === null,
      JSON.stringify({ pdf: pdf?.byteLength, borrowed }),
    );

    /* -------------------------------------------------------- what ETA refuses */
    const plain = buildEtaDocument({
      kind: "invoice",
      issuer: { type: "B", id: "100200300", name: "Demo", address: { branchID: "0", country: "EG", governate: "Cairo", regionCity: "Cairo", street: "S", buildingNumber: "1" } },
      receiver: { type: "B", id: "987654321", name: "Co", address: { country: "EG", governate: "Giza", regionCity: "Giza", street: "S", buildingNumber: "2" } },
      internalId: `FORGED-${fixture}`,
      issuedAt: new Date(Date.now() - 60_000),
      activityCode: "8690",
      item: { description: "x", code: "EG-100200300-1" },
      netMinor: 10_000,
      vatMinor: 1_400,
      vatBps: 1_400,
    });
    const unsigned = await FAKE_ETA.submit(`[${toEtaJson(plain)}]`);
    const signature = await FAKE_SIGNER.sign(serializeEta(plain));
    const tampered = { ...plain, signatures: [{ signatureType: "I", value: signature.ok ? signature.cades : "" }], receiver: { ...(plain.receiver as object), id: "111222333" } };
    const forged = await FAKE_ETA.submit(`[${toEtaJson(tampered)}]`);
    const duplicate = await FAKE_ETA.submit(`[${invoice.document_text ?? "{}"}]`);
    check(
      "🔴 0147 unsigned, signed over other text, and an internal id already accepted: each refused",
      unsigned.ok && unsigned.rejected[0]?.error === "Document is not signed" &&
        forged.ok && forged.rejected[0]?.error === "Signature is not valid for this document" &&
        duplicate.ok && duplicate.rejected[0]?.error === "Duplicate internal id",
      JSON.stringify({ unsigned, forged, duplicate }),
    );

    const honest = { ...plain, internalID: `HONEST-${fixture}` };
    const honestSig = await FAKE_SIGNER.sign(serializeEta(honest));
    const accepted = await FAKE_ETA.submit(
      `[${toEtaJson({ ...honest, signatures: [{ signatureType: "I", value: honestSig.ok ? honestSig.cades : "" }] })}]`,
    );
    check(
      "🔴 0147 CONTROL the same document, honestly signed under a new internal id, is accepted, so the refusals above are not blanket ones",
      accepted.ok && accepted.accepted.length === 1 && accepted.rejected.length === 0,
      JSON.stringify(accepted),
    );

    /* ------------------------------------------------------------- a return */
    const potBefore = Number((await one<{ b: number }>(db, sql`SELECT balance_cents AS b FROM sponsor_pots WHERE sponsor_id = ${sponsor.id}`)).b);
    const spentBefore = (await potTotals(sponsor.id)).spentCents;
    const tooMuch = await requestPotReturn({ sponsorId: sponsor.id, netCents: potBefore + 1, egpMinor: 1, reason: "Closing the account", requestedBy: opA.id });
    const asked = await requestPotReturn({ sponsorId: sponsor.id, netCents: 5_000, egpMinor: egpMinorFor(5_700, rate), reason: "Closing one department", requestedBy: opA.id });
    const twice = await requestPotReturn({ sponsorId: sponsor.id, netCents: 1_000, egpMinor: 1_000, reason: "Again", requestedBy: opA.id });
    check(
      "🔴 0148 more than the pot holds is refused, and one open return at a time",
      "error" in tooMuch && "ok" in asked && "error" in twice,
      JSON.stringify({ tooMuch, asked, twice }),
    );
    const askedId = "ok" in asked ? asked.id : "";

    const self = await sendPotReturn({ id: askedId, sentBy: opA.id, bankReference: "CIB-1" });
    const noRef = await sendPotReturn({ id: askedId, sentBy: opB.id, bankReference: " " });
    check(
      "🔴 0148 the person who asked cannot send, and nobody sends without the bank reference",
      "error" in self && "error" in noRef,
      JSON.stringify({ self, noRef }),
    );

    const done = await sendPotReturn({ id: askedId, sentBy: opB.id, bankReference: `CIB-${fixture}` });
    const again = await sendPotReturn({ id: askedId, sentBy: opB.id, bankReference: `CIB-${fixture}` });
    const potAfter = Number((await one<{ b: number }>(db, sql`SELECT balance_cents AS b FROM sponsor_pots WHERE sponsor_id = ${sponsor.id}`)).b);
    const ledgerAfter = await ledgerPotBalance(sponsor.id);
    const spentAfter = (await potTotals(sponsor.id)).spentCents;
    const legs = (await db.execute(sql`
      SELECT account, amount_cents FROM ledger_entries
       WHERE txn_kind = 'pot_return' AND ref_id = ${sponsor.id} ORDER BY account`)).rows as { account: string; amount_cents: number }[];
    const legSum = legs.reduce((n, l) => n + Number(l.amount_cents), 0);
    check(
      "🔴 0148 sent once by a second person: the pot and the ledger fall together, the books balance, and it is not a spend",
      "ok" in done && "error" in again && potAfter === potBefore - 5_000 && ledgerAfter === potAfter &&
        spentAfter === spentBefore && legs.length === 3 && legSum === 0,
      JSON.stringify({ done, again, potBefore, potAfter, ledgerAfter, spentBefore, spentAfter, legs }),
    );

    const all = await docs();
    const note = all.find((d) => d.kind === "credit_note");
    const noteText = JSON.parse(note?.document_text ?? "{}") as { documentType?: string; references?: string[] };
    check(
      "🔴 0148 the return's credit note is issued and names the invoice it corrects",
      note?.state === "valid" && noteText.documentType === "C" && (noteText.references ?? []).includes(invoice.eta_uuid ?? "-"),
      JSON.stringify({ note, references: noteText.references }),
    );

    /* A credit note larger than everything invoiced waits instead of being refused by ETA. */
    const big = await requestPotReturn({ sponsorId: sponsor.id, netCents: 1_000, egpMinor: Number(invoice.total_minor) * 3, reason: "A return larger than invoiced", requestedBy: opA.id });
    if ("ok" in big) await sendPotReturn({ id: big.id, sentBy: opB.id, bankReference: `CIB-2-${fixture}` });
    const waitingNote = (await docs()).filter((d) => d.kind === "credit_note").find((d) => d.state === "waiting");
    check(
      "🔴 0148 a credit note larger than what was invoiced waits, and says on what",
      Boolean(waitingNote) && (waitingNote?.waiting_for ?? "").includes("invoices it credits"),
      JSON.stringify(waitingNote),
    );

    const listed = await documentsFor(sponsor.id);
    const otherListed = await documentsFor(other.id);
    check(
      "🔴 0147 a company lists its own documents and no other company's",
      listed.length === (await docs()).length && listed.length >= 3 && otherListed.length === 0,
      JSON.stringify({ listed: listed.length, all: all.length, other: otherListed.length }),
    );

    /* ------------------------------------------------------------- readiness */
    Object.assign(env, { etaMode: "fake", etaSigner: "fake", liveDeployment: true });
    const onLive = whatEtaNeeds();
    Object.assign(env, { etaMode: "preprod", etaSigner: "remote", liveDeployment: false, etaClientId: "" });
    const preprod = whatEtaNeeds();
    check(
      "🔴 0147 the simulator is refused on the live deployment, and preprod asks for its credentials and signer",
      onLive.length >= 1 && preprod.some((n) => n.includes("ETA_CLIENT_ID")) && preprod.some((n) => n.includes("ETA_SIGNER_URL")),
      JSON.stringify({ onLive, preprod }),
    );
  } finally {
    Object.assign(env, { etaMode: saved.mode, etaSigner: saved.signer, liveDeployment: saved.live, etaClientId: saved.id });
    await writeSettingsGroup({ group: "invoice", value: invoiceBefore, updatedBy: opA.id }).catch(() => undefined);
    for (const s of [sponsor.id, other.id]) {
      await db.execute(sql`DELETE FROM eta_documents WHERE sponsor_id = ${s} AND kind = 'credit_note'`);
      await db.execute(sql`DELETE FROM eta_documents WHERE sponsor_id = ${s}`);
      await db.execute(sql`DELETE FROM pot_returns WHERE sponsor_id = ${s}`);
      await db.execute(sql`DELETE FROM ledger_entries WHERE ref_type = 'sponsor' AND ref_id = ${s}`);
      await db.execute(sql`DELETE FROM manual_payments WHERE sponsor_id = ${s}`);
      await db.execute(sql`DELETE FROM sponsor_pots WHERE sponsor_id = ${s}`);
      await db.execute(sql`DELETE FROM sponsors WHERE id = ${s}`);
    }
    await db.execute(sql`DELETE FROM audit_log WHERE actor_user_id IN (SELECT id FROM users WHERE organization_id = ${org.id})`).catch(() => undefined);
    await db.execute(sql`UPDATE platform_settings SET updated_by = NULL WHERE updated_by IN (SELECT id FROM users WHERE organization_id = ${org.id})`).catch(() => undefined);
    await db.execute(sql`DELETE FROM users WHERE organization_id = ${org.id}`);
    await db.execute(sql`DELETE FROM organizations WHERE id = ${org.id}`);
    await pool.end();
  }

  finish("0147 ETA e-invoicing");
}

void main();

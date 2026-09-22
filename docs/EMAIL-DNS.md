# Email authentication

What is published for `24therapy.app`, what is not, and what the gap costs.

`npm run verify:email-dns` asks live DNS rather than this file, and fails if a
record that used to resolve stops resolving. This file is the argument; the
gate is the fact.

---

## Measured, on the day of the audit

| Record | State | What it does |
| --- | --- | --- |
| SPF | `v=spf1 include:zohomail.com ~all` | Authorises Zoho, which hosts the mailboxes |
| DKIM `zmail._domainkey` | published | Signs mail sent from a Zoho mailbox |
| DKIM `resend._domainkey` | published | Signs the product's transactional mail |
| DMARC `_dmarc` | `v=DMARC1; p=none; rua=…; sp=none; adkim=r; aspf=r` | Reports who sends as us. Enforces nothing yet, on purpose |

---

## 🔴 DMARC is published, and the clock is running

Added 2026-09-22 at `p=none` with `rua` pointing at the founder's inbox, and
relaxed alignment on both mechanisms. `verify:email-dns` treats `p=none` as
fine until **2026-10-06** and fails after it, so the fortnight below is a date
the gate counts rather than a thing somebody remembers.

Relaxed alignment is load-bearing while SPF still does not name Resend: under
`aspf=s` every transactional message would fail SPF alignment and rest on DKIM
alone, and a later `p=reject` would quarantine every password reset and session
invitation this product sends. The gate checks that too.

`ruf=` was deliberately left off. Failure reports carry the failing message,
headers and sometimes body, and this product's mail carries session
invitations and links into a clinical record. Google and Microsoft do not send
`ruf` anyway, so it would have been the exposure without the benefit.

## 🔴 What a missing DMARC would have cost, which is why it was added

**Anybody can send mail as `24therapy.app` and no receiver is told to refuse
it.** SPF and DKIM let a receiver check a message; DMARC is the record that
says what to DO when the check fails, and without it the answer is usually
"deliver it anyway".

For this product that is not a generic phishing risk. Our mail carries session
invitations, password resets and links into a clinical record, so a convincing
forgery has somewhere to send a person. A patient who has been told to expect
mail from us is a patient primed to trust it.

It also costs us the reporting. `rua=` is how you find out who is sending as
your domain, and with no DMARC record nobody is telling us.

## What the SPF gap costs, which is less than it looks

SPF names Zoho and the product sends through Resend, so **SPF fails on our
transactional mail**. That sounds fatal and is not, for one reason worth
writing down rather than rediscovering:

> DMARC passes on EITHER aligned SPF or aligned DKIM.

Resend signs with `resend._domainkey.24therapy.app` and the From header is
`noreply@24therapy.app`, so DKIM aligns and the mail authenticates. Adding
Resend to SPF is still worth doing, because SPF is what survives when a
forwarding server breaks the DKIM signature.

---

## What to add, and where the values come from

**🔴 Take the exact strings from the provider's own dashboard.** A verifier
that hard-codes a guess teaches somebody to paste a wrong record, so this file
describes the shape and names the source rather than inventing the value.

### 1 · DMARC, the one that is missing

Add a TXT record at `_dmarc.24therapy.app`:

```
v=DMARC1; p=none; rua=mailto:dmarc@24therapy.app; fo=1
```

Start at `p=none`. It enforces nothing and that is the point: it turns on the
reports so you can see every sender using the domain before you start refusing
any of them. Turning on `p=reject` first is how a company discovers its own
invoicing system was sending as the domain, by having it stop.

Read the reports for a fortnight, confirm the only senders are Zoho and Resend,
then move to `p=quarantine` and finally `p=reject`.

`npm run verify:email-dns` fails the policy line while it is still `p=none`, so
the intermediate state cannot quietly become the permanent one.

### 2 · SPF, so a forwarder cannot strip our only proof

Replace the existing record with one that names both senders. Resend publishes
its include in the dashboard under the sending domain; take it from there
rather than from here.

Two rules that are not obvious:

- **One SPF record per domain.** Two `v=spf1` records is a permanent error,
  not a merge.
- **Ten DNS lookups, total.** Each `include:` costs at least one. Two is fine;
  a record that accumulates six is one that silently stops evaluating.

Keep `~all` until the DMARC reports are clean, then `-all`.

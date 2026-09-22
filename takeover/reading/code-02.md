# Slice 02: data-a-f

## Files

### lib/data/actuals.ts (640 lines)
- For: `/admin/actuals`, the company's measured monthly result (revenue, spend, bank, held-for-others, runway). super_admin only, never clinical.
- Decides: `monthlyActuals` (229) builds the month range from six sources, earliest wins (`monthRange` 473); revenue is `-SUM` of `platform_revenue` split by `ref_type` (`ledgerByMonth` 567, 593 to 609); completed sessions only (`activityByMonth` 540); AI cost rounded once (309, `CENTS_PER_MICRO = 1000`, consistent with H13: 1000 units per cent); `oursCents = bank - held` (356); burn over trailing three months, null when profitable (`positionFrom` 425 to 432); runway floors negative "ours" at zero (432).
- Assumes: ledger sign convention (positive = debit) from `lib/billing/ledger.ts`; `capitalByMonth` returns a CUMULATIVE figure per month (it is used as "capital in by end of month" at 329); `payrollByMonth` in `lib/data/payroll.ts`.
- Promises: none of P1..A5 directly. Reads `sessions` counts only (no names). Not clinical.
- Notes: `monthRange` counts FORWARD from the first month and stops at `maxMonths` (496), so once the business is older than 36 months the page shows the first 36 and never the current month, while the running cash also stops accumulating. Ledger months outside the range are silently dropped from every total. `NOT_MEASURED_HERE` (57) is printed on the page; its payroll text hardcodes "two of the seven on the payroll are founders drawing the same $500" (70), a data claim frozen in source.

### lib/data/admin-team.ts (80 lines)
- For: `createBackOfficeUser`, minting `staff` / `manager` accounts in our own org (slug `24therapy`).
- Decides: role enum closed to staff|manager (53), super_admin not creatable (comment 28), org looked up by slug (57), password through `validatePassword` (50). Any insert failure is reported as "already an account with that email" (74 to 76), which hides every other failure (a CHECK, a missing column).
- Assumes: caller is behind `requireRole("super_admin")` (not checked here); `users.email` unique.
- Promises: A5 (role is a list): serves it by making non-founder accounts exist. No audit written in this function; caller must.
- Notes: logs email via `ref()` (hashed ref), fine.

### lib/data/admin.ts (468 lines)
- For: cross-organisation admin reads (stats, clinician list, one clinician in full, audit log, AI usage) plus `setUserStatus` and `setVerification`.
- Decides: header (35) says every function must be behind `requireRole("super_admin")`; nothing in the file checks it. `therapistPatients` (291) returns patient names, emails, phones for a clinician; `therapistSessions` (343) patient names and session times; `therapistCopilotUsage` (373) counts only; `listAuditLog` (193) deliberately does not join patients, joins the three actor tables (users, sponsor_users, clinic_managers). AI cost from `cost_microcents / 1000` rounded once (74, 417, 447).
- Assumes: callers audit. Checked: `app/(admin)/admin/therapists/[id]/page.tsx:40,48` does `requireRole("super_admin")` then a `break_glass` audit before reads; `app/(admin)/admin/actions.ts:45,59` audits suspend and verify.
- Promises: A5 (every read written down): kept for the one-clinician page. Not a sponsor/clinic surface.
- Notes: `platformStats.clinicians` (50) counts every `users` row including staff, managers and super_admins, labelled clinicians. `listClinicians` (101) and `therapistOverview` (259) left-join `subscriptions` on organisation, so an organisation with more than one subscription row duplicates the clinician row. `setVerification` (146) writes `users.verification_status` first; migration `drizzle/0083_verification_one_truth.sql:108 to 121` forces that column to the derived value on every update, so the first write is a no-op and the comment "written to both places" (132 to 139) is stale. It sets `reviewedAt` even for "pending" / "unverified" (178), so an admin resetting to pending looks reviewed.


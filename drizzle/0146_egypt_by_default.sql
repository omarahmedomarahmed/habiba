-- Egypt only, for now (founder, 2026-09-24): no US therapists, patients or
-- companies soon, and Stripe is switched off. A new practice is Egyptian (the
-- transfer rail, 14% VAT, the Egyptian gateway when contracted), and a new
-- company is billed by the Egyptian entity. Existing rows are left as they
-- are: rewriting them would change the rail and the tax of money already
-- recorded against them.
ALTER TABLE "organizations" ALTER COLUMN "region" SET DEFAULT 'eg';
--> statement-breakpoint
ALTER TABLE "sponsors" ALTER COLUMN "entity" SET DEFAULT 'eg';

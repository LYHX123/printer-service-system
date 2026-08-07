-- Catch-up migration: captures Customer schema drift applied to dev via `prisma
-- db push` that was never recorded in a tracked migration, following the same
-- pattern as 20260703130000_sync_task_and_invoice_modules.
--
-- Background: at the very first migration (20260608125010_init), Customer.name
-- was the required "company name" field and Customer.companyName was an
-- optional secondary field. The application model was later refactored so that
-- Customer.companyName is the required company name and Customer.name is an
-- optional "main contact person" field (see CustomerForm.tsx / schemas.ts /
-- every read site under src/, which all treat companyName as the customer's
-- identity and name as an optional contact snapshot). That refactor was applied
-- to the dev database directly via `db push` and never captured as a tracked
-- migration, so any database that only ever received tracked migrations (e.g.
-- production) still has the ORIGINAL constraints: name NOT NULL, companyName
-- nullable. createCustomer/updateCustomer already write the current, correct
-- model (companyName always populated, name nullable) — on such a database
-- that write fails with P2011 (null constraint violation on "name") the moment
-- the optional contact-name field is left blank.
--
-- This migration is additive/data-preserving only:
--   1. Relax Customer.name to nullable — pure loosening, cannot lose data,
--      immediately fixes the P2011 crash.
--   2. Backfill Customer.companyName from the legacy Customer.name value for
--      any row that still has no companyName — under the original schema this
--      is exactly where a customer's real company name would have been stored,
--      so this preserves that historical value instead of discarding it. Rows
--      created under the current application model already have companyName
--      populated, so this is a no-op for them. A final 'Unknown Company'
--      fallback only applies if a row somehow has neither value, guaranteeing
--      step 3 cannot fail on unexpected data.
--   3. Enforce Customer.companyName NOT NULL — safe specifically because step 2
--      guarantees no row is left null.
-- No table, column, or row is dropped or deleted.

-- ── Customer.name: relax to optional (matches current application model) ────
ALTER TABLE "Customer" ALTER COLUMN "name" DROP NOT NULL;

-- ── Backfill companyName from the legacy name value before enforcing NOT NULL ─
UPDATE "Customer"
SET "companyName" = COALESCE(NULLIF(TRIM("companyName"), ''), NULLIF(TRIM("name"), ''), 'Unknown Company')
WHERE "companyName" IS NULL OR TRIM("companyName") = '';

-- ── Customer.companyName: enforce NOT NULL (matches current application model) ─
ALTER TABLE "Customer" ALTER COLUMN "companyName" SET NOT NULL;

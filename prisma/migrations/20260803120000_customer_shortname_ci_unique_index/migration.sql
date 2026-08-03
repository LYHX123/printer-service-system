-- Customer Dropbox Phase 2 — Short Name becomes the folder name under
-- Printer Service System/Customer/{ShortName}, so it must be unique per
-- company (compared case-insensitively: "CRBC" and "crbc" collide).
--
-- This is a partial index (WHERE "shortName" IS NOT NULL): Postgres already
-- treats NULLs as distinct for plain uniqueness, but a case-insensitive
-- functional index needs the WHERE clause spelled out explicitly. It never
-- touches the existing rows that still have a NULL Short Name (legacy
-- customers, pre-dating this field) — they stay exactly as they are until
-- someone edits that customer to add one, per the app-level requirement
-- enforced in src/lib/schemas.ts + src/lib/actions/customers.ts.
CREATE UNIQUE INDEX IF NOT EXISTS "Customer_companyId_shortName_ci_key"
  ON "Customer" ("companyId", lower("shortName"))
  WHERE "shortName" IS NOT NULL;

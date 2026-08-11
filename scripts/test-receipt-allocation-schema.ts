/**
 * Regression check for the LedgerEntrySchema allocation rules (withholding-tax change).
 * Not wired into any module — run directly with:
 *   npx tsx scripts/test-receipt-allocation-schema.ts
 */
import { LedgerEntrySchema } from "../src/lib/schemas"

let failures = 0

function check(label: string, condition: boolean) {
  if (condition) {
    console.log(`  OK — ${label}`)
  } else {
    console.error(`  FAIL — ${label}`)
    failures++
  }
}

function baseInput(overrides: Partial<Parameters<typeof LedgerEntrySchema.safeParse>[0]> = {}) {
  return {
    type: "INCOME" as const,
    categoryId: "cat-1",
    date: "2026-08-11",
    amount: 10000,
    paymentMethod: "BANK_TRANSFER" as const,
    customerId: "cust-1",
    allocations: [],
    ...overrides,
  }
}

console.log("\n[Case A] Normal receipt — allocation === receipt amount")
{
  const input = baseInput({ allocations: [{ salesLedgerEntryId: "sl-1", amount: 10000 }] })
  const result = LedgerEntrySchema.safeParse(input)
  check("parses successfully", result.success)
}

console.log("\n[Case B] Partial allocation — allocation < receipt amount")
{
  const input = baseInput({ allocations: [{ salesLedgerEntryId: "sl-1", amount: 6000 }] })
  const result = LedgerEntrySchema.safeParse(input)
  check("parses successfully", result.success)
}

console.log("\n[Case C] Withholding tax — allocation (17,400) > receipt amount (10,000)")
{
  const input = baseInput({ amount: 10000, allocations: [{ salesLedgerEntryId: "sl-1", amount: 17400 }] })
  const result = LedgerEntrySchema.safeParse(input)
  check("parses successfully — no longer rejected", result.success)
}

console.log("\n[Case E] One receipt split across two Sales Ledger records, total > receipt amount")
{
  const input = baseInput({
    amount: 10000,
    allocations: [
      { salesLedgerEntryId: "sl-A", amount: 7000 },
      { salesLedgerEntryId: "sl-B", amount: 6000 },
    ],
  })
  const result = LedgerEntrySchema.safeParse(input)
  check("parses successfully (total 13,000 > receipt 10,000)", result.success)
}

console.log("\n[Guard] Each allocation must still be > 0")
{
  const input = baseInput({ allocations: [{ salesLedgerEntryId: "sl-1", amount: 0 }] })
  const result = LedgerEntrySchema.safeParse(input)
  check("rejected — zero allocation is invalid", !result.success)
}
{
  const input = baseInput({ allocations: [{ salesLedgerEntryId: "sl-1", amount: -5 }] })
  const result = LedgerEntrySchema.safeParse(input)
  check("rejected — negative allocation is invalid", !result.success)
}

if (failures > 0) {
  console.error(`\n${failures} check(s) FAILED`)
  process.exit(1)
}
console.log("\nAll LedgerEntrySchema allocation checks passed.")

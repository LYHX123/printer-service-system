/**
 * Regression check for the withholding-tax Receipt Allocation change, against a real
 * database. Exercises the actual recomputeSalesLedgerEntry()/validateAllocations()
 * functions from src/lib/actions/ledger.ts (temporarily exported for this purpose)
 * plus the Monthly Sales Statistics / Current Month Income data functions.
 *
 * Creates and tears down its own Customer/SalesLedgerEntry/LedgerEntry rows under the
 * seeded TECHFIX company — does not touch anything else. Run directly with:
 *   npx tsx scripts/test-receipt-allocation-db.ts
 */
import "dotenv/config"
import { prisma } from "../src/lib/prisma"
import { recomputeSalesLedgerEntry, validateAllocations } from "../src/lib/actions/ledger"
import {
  getSalesLedgerMonthlyStatistics,
  getCurrentMonthSalesIncomeTotal,
  getLedgerMonthStats,
} from "../src/lib/data/ledger"

let failures = 0
function check(label: string, condition: boolean) {
  if (condition) {
    console.log(`  OK — ${label}`)
  } else {
    console.error(`  FAIL — ${label}`)
    failures++
  }
}

async function main() {
  const company = await prisma.company.findUniqueOrThrow({ where: { code: "TECHFIX" } })
  const admin = await prisma.user.findFirstOrThrow({ where: { companyId: company.id, role: "ADMIN" } })

  const category = await prisma.ledgerCategory.upsert({
    where: { companyId_type_name: { companyId: company.id, type: "INCOME", name: "QA Regression Test" } },
    update: {},
    create: { companyId: company.id, type: "INCOME", name: "QA Regression Test" },
  })

  const customer = await prisma.customer.create({
    data: {
      companyId: company.id,
      code: `QA-REG-${Date.now()}`,
      companyName: "QA Regression Customer",
      shortName: `qa-regression-${Date.now()}`,
    },
  })

  const ledgerEntryIds: string[] = []
  const salesLedgerEntryIds: string[] = []

  async function makeSalesLedgerEntry(invoiceAmount: number) {
    const entry = await prisma.salesLedgerEntry.create({
      data: {
        companyId: company.id,
        date: new Date(),
        customerName: customer.companyName,
        customerId: customer.id,
        invoiceAmount,
        amountReceived: 0,
        balance: invoiceAmount,
        paymentStatus: "UNPAID",
        createdById: admin.id,
      },
    })
    salesLedgerEntryIds.push(entry.id)
    return entry
  }

  type ReceiptResult = { success: true; entryId: string } | { error: string }

  /** Mirrors createLedgerEntry's core transaction body (minus the auth/permission wrapper, unchanged by this task). */
  async function createReceipt(amount: number, allocations: { salesLedgerEntryId: string; amount: number }[]): Promise<ReceiptResult> {
    return prisma.$transaction(async (tx): Promise<ReceiptResult> => {
      if (allocations.length > 0) {
        const err = await validateAllocations(tx, company.id, allocations)
        if (err) return { error: err }
      }
      const entry = await tx.ledgerEntry.create({
        data: {
          companyId: company.id,
          type: "INCOME",
          categoryId: category.id,
          date: new Date(),
          amount,
          paymentMethod: "BANK_TRANSFER",
          customerId: customer.id,
          createdById: admin.id,
        },
      })
      if (allocations.length > 0) {
        await tx.receiptAllocation.createMany({
          data: allocations.map((a) => ({
            ledgerEntryId: entry.id,
            salesLedgerEntryId: a.salesLedgerEntryId,
            allocatedAmount: a.amount,
            createdById: admin.id,
          })),
        })
        for (const a of allocations) await recomputeSalesLedgerEntry(tx, a.salesLedgerEntryId)
      }
      return { success: true as const, entryId: entry.id }
    })
  }

  /** Mirrors updateLedgerEntry's core transaction body: roll back old allocations, validate + apply new ones. */
  async function editReceipt(ledgerEntryId: string, newAmount: number, newAllocations: { salesLedgerEntryId: string; amount: number }[]): Promise<{ success: true } | { error: string }> {
    return prisma.$transaction(async (tx): Promise<{ success: true } | { error: string }> => {
      const old = await tx.receiptAllocation.findMany({ where: { ledgerEntryId }, select: { salesLedgerEntryId: true } })
      await tx.receiptAllocation.deleteMany({ where: { ledgerEntryId } })
      for (const o of old) await recomputeSalesLedgerEntry(tx, o.salesLedgerEntryId)

      if (newAllocations.length > 0) {
        const err = await validateAllocations(tx, company.id, newAllocations)
        if (err) return { error: err }
      }
      await tx.ledgerEntry.update({ where: { id: ledgerEntryId }, data: { amount: newAmount } })
      if (newAllocations.length > 0) {
        await tx.receiptAllocation.createMany({
          data: newAllocations.map((a) => ({
            ledgerEntryId,
            salesLedgerEntryId: a.salesLedgerEntryId,
            allocatedAmount: a.amount,
            createdById: admin.id,
          })),
        })
        for (const a of newAllocations) await recomputeSalesLedgerEntry(tx, a.salesLedgerEntryId)
      }
      return { success: true as const }
    })
  }

  /** Mirrors deleteLedgerEntry's core transaction body. */
  async function deleteReceipt(ledgerEntryId: string) {
    await prisma.$transaction(async (tx) => {
      const allocations = await tx.receiptAllocation.findMany({ where: { ledgerEntryId }, select: { salesLedgerEntryId: true } })
      await tx.ledgerEntry.delete({ where: { id: ledgerEntryId } })
      for (const a of allocations) await recomputeSalesLedgerEntry(tx, a.salesLedgerEntryId)
    })
  }

  // Company-wide baselines, captured before this run creates anything — Case H below
  // compares against the DELTA these functions move by, since both are legitimately
  // company-wide aggregates and the dev database may already hold real data.
  const baselineCollected = await getCurrentMonthSalesIncomeTotal(company.id)
  const baselineCashIncome = (await getLedgerMonthStats(company.id)).income

  try {
    console.log("\n[Case A] Normal receipt — Receipt 10,000 / Allocate 10,000")
    {
      const sl = await makeSalesLedgerEntry(10000)
      const result = await createReceipt(10000, [{ salesLedgerEntryId: sl.id, amount: 10000 }])
      check("save succeeded", "success" in result)
      if ("entryId" in result) ledgerEntryIds.push(result.entryId)
      const fresh = await prisma.salesLedgerEntry.findUniqueOrThrow({ where: { id: sl.id } })
      check("Sales Ledger amountReceived = 10,000", Number(fresh.amountReceived) === 10000)
      check("Sales Ledger balance = 0", Number(fresh.balance) === 0)
      check("Sales Ledger status = PAID", fresh.paymentStatus === "PAID")
    }

    console.log("\n[Case B] Partial allocation — Receipt 10,000 / Allocate 6,000")
    {
      const sl = await makeSalesLedgerEntry(10000)
      const result = await createReceipt(10000, [{ salesLedgerEntryId: sl.id, amount: 6000 }])
      check("save succeeded", "success" in result)
      if ("entryId" in result) ledgerEntryIds.push(result.entryId)
      const fresh = await prisma.salesLedgerEntry.findUniqueOrThrow({ where: { id: sl.id } })
      check("Sales Ledger amountReceived = 6,000", Number(fresh.amountReceived) === 6000)
      check("Sales Ledger balance = 4,000 (Unallocated concept)", Number(fresh.balance) === 4000)
      check("Sales Ledger status = PARTIAL", fresh.paymentStatus === "PARTIAL")
    }

    let caseCLedgerEntryId = ""
    let caseCSalesId = ""
    console.log("\n[Case C] Withholding tax — Sales balance 17,400 / Receipt 10,000 / Allocate 17,400")
    {
      const sl = await makeSalesLedgerEntry(17400)
      caseCSalesId = sl.id
      const result = await createReceipt(10000, [{ salesLedgerEntryId: sl.id, amount: 17400 }])
      check("save succeeded (NOT rejected as 'exceeds receipt amount')", "success" in result)
      if ("entryId" in result) {
        ledgerEntryIds.push(result.entryId)
        caseCLedgerEntryId = result.entryId
      }
      const freshSales = await prisma.salesLedgerEntry.findUniqueOrThrow({ where: { id: sl.id } })
      check("Sales Ledger amountReceived = 17,400 (full invoice, not receipt cash)", Number(freshSales.amountReceived) === 17400)
      check("Sales Ledger balance = 0", Number(freshSales.balance) === 0)
      check("Sales Ledger status = PAID", freshSales.paymentStatus === "PAID")
      const freshLedger = await prisma.ledgerEntry.findUniqueOrThrow({ where: { id: caseCLedgerEntryId } })
      check("LedgerEntry.amount stays 10,000 (actual cash received)", Number(freshLedger.amount) === 10000)
    }

    console.log("\n[Case D] Overcap still rejected — Sales balance 17,400 / Allocate 18,000")
    {
      const sl = await makeSalesLedgerEntry(17400)
      const result = await createReceipt(18000, [{ salesLedgerEntryId: sl.id, amount: 18000 }])
      check("save rejected", "error" in result && result.error === "ALLOCATION_EXCEEDS_BALANCE")
      const fresh = await prisma.salesLedgerEntry.findUniqueOrThrow({ where: { id: sl.id } })
      check("Sales Ledger balance untouched at 17,400 (never went negative)", Number(fresh.balance) === 17400)
      check("no LedgerEntry was created for the rejected receipt", !("entryId" in result))
    }

    let caseESalesA = "", caseESalesB = ""
    console.log("\n[Case E] One receipt split across two Sales Ledger records — total allocation > receipt amount")
    {
      const slA = await makeSalesLedgerEntry(8000)
      const slB = await makeSalesLedgerEntry(7000)
      caseESalesA = slA.id
      caseESalesB = slB.id
      const result = await createReceipt(10000, [
        { salesLedgerEntryId: slA.id, amount: 7000 },
        { salesLedgerEntryId: slB.id, amount: 6000 },
      ])
      check("save succeeded (total 13,000 > receipt 10,000, each line within its own balance)", "success" in result)
      if ("entryId" in result) ledgerEntryIds.push(result.entryId)
      const freshA = await prisma.salesLedgerEntry.findUniqueOrThrow({ where: { id: slA.id } })
      const freshB = await prisma.salesLedgerEntry.findUniqueOrThrow({ where: { id: slB.id } })
      check("Sales A amountReceived = 7,000, balance = 1,000", Number(freshA.amountReceived) === 7000 && Number(freshA.balance) === 1000)
      check("Sales B amountReceived = 6,000, balance = 1,000", Number(freshB.amountReceived) === 6000 && Number(freshB.balance) === 1000)

      console.log("  [Case E, per-line guard] a 3rd allocation on Sales A exceeding its remaining 1,000 balance must still fail")
      const overResult = await createReceipt(500, [{ salesLedgerEntryId: slA.id, amount: 1500 }])
      check("rejected", "error" in overResult && overResult.error === "ALLOCATION_EXCEEDS_BALANCE")
    }

    console.log("\n[Case F] Edit receipt — reallocate Case A's receipt from 10,000 down to 5,000")
    {
      // Re-derive Case A's sales entry via its (now sole) allocation before editing.
      const alloc = await prisma.receiptAllocation.findFirstOrThrow({ where: { ledgerEntryId: ledgerEntryIds[0] } })
      const salesId = alloc.salesLedgerEntryId
      const result = await editReceipt(ledgerEntryIds[0], 10000, [{ salesLedgerEntryId: salesId, amount: 5000 }])
      check("edit succeeded", "success" in result)
      const fresh = await prisma.salesLedgerEntry.findUniqueOrThrow({ where: { id: salesId } })
      check("Sales Ledger amountReceived recomputed to 5,000", Number(fresh.amountReceived) === 5000)
      check("Sales Ledger balance recomputed to 5,000", Number(fresh.balance) === 5000)
      check("Sales Ledger status = PARTIAL", fresh.paymentStatus === "PARTIAL")
    }

    console.log("\n[Case G] Delete receipt — Case C's receipt (the withholding-tax one)")
    {
      await deleteReceipt(caseCLedgerEntryId)
      const fresh = await prisma.salesLedgerEntry.findUniqueOrThrow({ where: { id: caseCSalesId } })
      check("Sales Ledger amountReceived reverted to 0", Number(fresh.amountReceived) === 0)
      check("Sales Ledger balance reverted to 17,400", Number(fresh.balance) === 17400)
      check("Sales Ledger status reverted to UNPAID", fresh.paymentStatus === "UNPAID")
      ledgerEntryIds.splice(ledgerEntryIds.indexOf(caseCLedgerEntryId), 1)
    }

    console.log("\n[Case H] Monthly statistics — Cumulative Received (allocations) vs Current Month Income (cash)")
    {
      const now = new Date()
      const [monthStat] = await getSalesLedgerMonthlyStatistics(company.id, now.getFullYear(), now.getMonth() + 1)
      const currentMonthCollected = await getCurrentMonthSalesIncomeTotal(company.id)
      const { income: currentMonthCashIncome } = await getLedgerMonthStats(company.id)

      // At this point our still-live rows are: Case A's receipt (edited in Case F to a
      // 5,000 allocation, LedgerEntry.amount stays 10,000), Case B's receipt (6,000
      // alloc / 10,000 cash), Case E's receipt (7,000+6,000=13,000 alloc / 10,000 cash).
      // Case C/D were reverted/rejected and contribute nothing. So allocation total
      // (collected) = 5,000+6,000+13,000 = 24,000 while cash (LedgerEntry.amount) =
      // 10,000+10,000+10,000 = 30,000 — the two figures diverge in BOTH directions
      // across different receipts (that's expected; withholding tax only pushes
      // allocation above cash on a given receipt, it doesn't force a company-wide
      // ordering), which is exactly why they must be computed independently rather
      // than derived from one another.
      const collectedDelta = currentMonthCollected - baselineCollected
      const cashDelta = currentMonthCashIncome - baselineCashIncome
      check("monthStat.collected includes our test allocations (delta >= 24,000)", monthStat.collected - baselineCollected >= 24000)
      check("Cumulative Received delta = 24,000 (SUM of live ReceiptAllocation rows)", collectedDelta === 24000)
      check("Current Month Income delta = 30,000 (SUM of live LedgerEntry.amount rows, unaffected by allocation edits)", cashDelta === 30000)
      check(
        "the two figures moved by different amounts — proof they are NOT derived from each other",
        collectedDelta !== cashDelta
      )
    }

    // Case E's per-line-guard leftover: the 3rd allocation attempt returned an error,
    // so createReceipt never created a LedgerEntry for it — nothing to clean up there.
  } finally {
    console.log("\nCleaning up test data…")
    for (const id of ledgerEntryIds) {
      await prisma.ledgerEntry.delete({ where: { id } }).catch(() => {})
    }
    for (const id of salesLedgerEntryIds) {
      await prisma.salesLedgerEntry.delete({ where: { id } }).catch(() => {})
    }
    await prisma.customer.delete({ where: { id: customer.id } }).catch(() => {})
    await prisma.$disconnect()
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED`)
    process.exit(1)
  }
  console.log("\nAll Receipt Allocation DB regression checks passed.")
}

main().catch((error) => {
  console.error("\nReceipt Allocation DB test FAILED:", error)
  process.exit(1)
})

/**
 * Regression coverage for the Sales Ledger "Invoice No" unification + safe-delete
 * feature (replaces the old separate Order No/Reference No column and the
 * Archive action) — src/lib/actions/ledger.ts, src/lib/ledger-utils.ts,
 * src/lib/data/ledger.ts, src/components/ledger/SalesLedger{Modal,Actions}.tsx.
 *
 * Exercises the real HTTP + Server Action path against a running dev server
 * (real NextAuth session cookies, real Prisma transactions) — same technique
 * as scripts/e2e-permission-security-test.ts. Creates its own disposable
 * company/users/customer/invoice/entries and deletes them all on exit.
 *
 * Prerequisite: `npm run dev` must already be running on BASE_URL.
 * Run with: npx tsx scripts/test-sales-ledger-invoice-unification.ts
 */
import "dotenv/config"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"
import bcrypt from "bcryptjs"
import fs from "node:fs/promises"
import path from "node:path"
import * as XLSX from "xlsx"
import { resolveSalesLedgerInvoiceNo } from "../src/lib/ledger-utils"
import {
  getSalesLedgerEntries,
  getSalesLedgerEntry,
  getCurrentMonthSalesTotal,
  getCurrentMonthSalesIncomeTotal,
  getUnpaidSalesBalance,
  getSalesLedgerMonthlyStatistics,
} from "../src/lib/data/ledger"

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000"
const PASSWORD = "E2eTest!2026"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

type Check = { area: string; description: string; pass: boolean; detail: string }
const results: Check[] = []
function record(area: string, description: string, pass: boolean, detail: string) {
  results.push({ area, description, pass, detail })
  console.log(`  [${pass ? "PASS" : "FAIL"}] ${description} — ${detail}`)
}

async function getCsrf(): Promise<{ csrfToken: string; cookie: string }> {
  const res = await fetch(`${BASE_URL}/api/auth/csrf`)
  const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0]
  const { csrfToken } = (await res.json()) as { csrfToken: string }
  return { csrfToken, cookie }
}

async function login(name: string): Promise<string> {
  const { csrfToken, cookie: csrfCookie } = await getCsrf()
  const body = new URLSearchParams({ name, password: PASSWORD, csrfToken, callbackUrl: `${BASE_URL}/dashboard`, json: "true" })
  const res = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: csrfCookie },
    body: body.toString(),
    redirect: "manual",
  })
  const setCookies = res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""]
  const sessionParts = setCookies.filter(Boolean).map((c) => c.split(";")[0])
  const merged = [csrfCookie, ...sessionParts].join("; ")
  const check = await fetch(`${BASE_URL}/api/auth/session`, { headers: { Cookie: merged } })
  const session = (await check.json()) as { user?: { name?: string } }
  if (!session?.user?.name) throw new Error(`Login failed for "${name}" — no session established`)
  return merged
}

async function getActionId(pageRoute: string, sourceFile: string, exportedName: string): Promise<string | null> {
  const manifestPath = path.join(process.cwd(), ".next", "dev", "server", "app", ...pageRoute.split("/"), "server-reference-manifest.json")
  try {
    const raw = await fs.readFile(manifestPath, "utf8")
    const manifest = JSON.parse(raw) as { node: Record<string, { exportedName: string; filename: string }> }
    for (const [id, entry] of Object.entries(manifest.node)) {
      if (entry.exportedName === exportedName && entry.filename === sourceFile) return id
    }
    return null
  } catch {
    return null
  }
}

async function callAction(cookie: string, pagePath: string, actionId: string, args: unknown[]): Promise<{ status: number; text: string }> {
  const res = await fetch(`${BASE_URL}${pagePath}`, {
    method: "POST",
    headers: { Cookie: cookie, Accept: "text/x-component", "Content-Type": "text/plain;charset=UTF-8", "Next-Action": actionId },
    body: JSON.stringify(args),
  })
  const text = await res.text()
  return { status: res.status, text }
}

function parseActionResult(text: string): Record<string, unknown> {
  const match = text.match(/^\d+:(\{"(?:success|error)":.*\})$/m)
  if (!match) throw new Error(`Could not parse action response: ${text.slice(0, 500)}`)
  return JSON.parse(match[1])
}

async function main() {
  console.log(`Target: ${BASE_URL}\n`)
  const passwordHash = await bcrypt.hash(PASSWORD, 10)

  const baselineSalesLedgerCount = await prisma.salesLedgerEntry.count()

  const companyA = await prisma.company.create({
    data: { name: "SLU Test Co A", code: `SLU-A-${Date.now()}`, currency: "KES", timezone: "Africa/Nairobi" },
  })
  const companyB = await prisma.company.create({
    data: { name: "SLU Test Co B", code: `SLU-B-${Date.now()}`, currency: "KES", timezone: "Africa/Nairobi" },
  })
  const adminA = await prisma.user.create({
    data: { companyId: companyA.id, name: `SLU Admin A ${Date.now()}`, passwordHash, role: "ADMIN", modulePermissions: [], isActive: true },
  })
  const adminB = await prisma.user.create({
    data: { companyId: companyB.id, name: `SLU Admin B ${Date.now()}`, passwordHash, role: "ADMIN", modulePermissions: [], isActive: true },
  })
  // Edit but no delete — proves Part 12's "no permission expansion" (ledger.sales.delete
  // stays a distinct gate from ledger.sales.edit, exactly as already catalogued).
  const editNoDeleteUser = await prisma.user.create({
    data: {
      companyId: companyA.id,
      name: `SLU EditNoDelete ${Date.now()}`,
      passwordHash,
      role: "RECEPTIONIST",
      modulePermissions: ["dashboard.view", "ledger.sales.view", "ledger.sales.create", "ledger.sales.edit"],
      isActive: true,
    },
  })

  const customerA = await prisma.customer.create({
    data: { companyId: companyA.id, code: `SLU-CUST-${Date.now()}`, companyName: "SLU Customer A", shortName: `SLUCustA${Date.now()}` },
  })
  const invoiceA = await prisma.invoice.create({
    data: {
      invoiceNumber: `SLU-INV-${Date.now()}`,
      companyId: companyA.id,
      customerId: customerA.id,
      createdById: adminA.id,
      date: new Date(),
      subtotal: 100000,
      vatPercent: 0,
      vatAmount: 0,
      totalAmount: 100000,
    },
    select: { id: true, invoiceNumber: true },
  })

  const salesPageActionId = (name: string) => getActionId("(dashboard)/ledger/sales/page", "src/lib/actions/ledger.ts", name)
  const createSalesActionId = await salesPageActionId("createSalesLedgerEntry")
  const updateSalesActionId = await salesPageActionId("updateSalesLedgerEntry")
  const deleteSalesActionId = await salesPageActionId("deleteSalesLedgerEntry")
  const createFromInvoiceActionId = await getActionId(
    "(dashboard)/quotations/invoices/[id]/page",
    "src/lib/actions/invoices.ts",
    "createSalesLedgerFromInvoice"
  )
  const createLedgerEntryActionId = await getActionId("(dashboard)/ledger/income-expense/page", "src/lib/actions/ledger.ts", "createLedgerEntry")

  if (!createSalesActionId || !updateSalesActionId || !deleteSalesActionId || !createFromInvoiceActionId || !createLedgerEntryActionId) {
    console.error("Could not resolve one or more action ids from the .next/dev manifest.")
    console.error("Make sure `npm run dev` is running and you have visited /ledger/sales, /ledger/income-expense and an Invoice Detail page at least once, then retry.")
    process.exit(1)
  }

  const cleanupSalesLedgerIds: string[] = []
  const cleanupLedgerEntryIds: string[] = []

  try {
    const cookieA = await login(adminA.name)

    // ─── A. Manual Sales Ledger — Invoice No is entered, stored, and shown everywhere ──
    console.log("\n=== A. Manual Sales Ledger Invoice No ===")
    let manualEntryId = ""
    {
      const res = await callAction(cookieA, "/ledger/sales", createSalesActionId, [
        { date: "2026-01-10", customerId: customerA.id, customerName: customerA.companyName, orderNo: "TEST-INV-001", invoiceAmount: 5000, amountReceived: 0, remark: "SLU manual" },
      ])
      const body = parseActionResult(res.text) as { success?: boolean; error?: string }
      record("A", "1. Create manual Sales Ledger with Invoice No = TEST-INV-001", body.success === true, JSON.stringify(body))
      const row = await prisma.salesLedgerEntry.findFirst({ where: { companyId: companyA.id, remark: "SLU manual" } })
      if (row) {
        manualEntryId = row.id
        cleanupSalesLedgerIds.push(row.id)
      }
      record("A", "2/3. Stored in orderNo field, no schema change needed", row?.orderNo === "TEST-INV-001", `orderNo=${row?.orderNo}`)

      const listEntries = await getSalesLedgerEntries(companyA.id, {})
      const listRow = listEntries.find((e) => e.id === manualEntryId)
      record("A", "4. List resolves Invoice No to TEST-INV-001", !!listRow && resolveSalesLedgerInvoiceNo(listRow) === "TEST-INV-001", `resolved=${listRow ? resolveSalesLedgerInvoiceNo(listRow) : "n/a"}`)

      const updateRes = await callAction(cookieA, "/ledger/sales", updateSalesActionId, [
        manualEntryId,
        { date: "2026-01-10", customerId: customerA.id, customerName: customerA.companyName, orderNo: "TEST-INV-001", invoiceAmount: 5000, amountReceived: 0, remark: "SLU manual" },
      ])
      const updateBody = parseActionResult(updateRes.text) as { success?: boolean }
      const detail = await getSalesLedgerEntry(manualEntryId, companyA.id)
      record("A", "5. Edit still displays TEST-INV-001", updateBody.success === true && resolveSalesLedgerInvoiceNo(detail!) === "TEST-INV-001", `resolved=${detail ? resolveSalesLedgerInvoiceNo(detail) : "n/a"}`)
      record("A", "6. Detail page resolves the same Invoice No", resolveSalesLedgerInvoiceNo(detail!) === "TEST-INV-001", "")

      const exportRes = await fetch(`${BASE_URL}/api/ledger/sales/export`, { headers: { Cookie: cookieA } })
      const exportBuf = Buffer.from(await exportRes.arrayBuffer())
      const wb = XLSX.read(exportBuf, { type: "buffer" })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })
      const headerRow = rows[0] as unknown as string[]
      const invoiceNoColIdx = headerRow.indexOf("Invoice No")
      const exportRow = rows.find((r) => Array.isArray(r) && r[1] === customerA.companyName && r[invoiceNoColIdx] === "TEST-INV-001")
      record("A", "7. Export header is 'Invoice No' (no separate Order No column) and shows TEST-INV-001", headerRow.includes("Invoice No") && !headerRow.some((h) => /order no/i.test(h)) && !!exportRow, `header=${JSON.stringify(headerRow)}`)
    }

    // ─── B. Invoice-generated Sales Ledger ─────────────────────────────────────
    console.log("\n=== B. Invoice-generated Sales Ledger ===")
    let generatedEntryId = ""
    {
      const res = await callAction(cookieA, `/quotations/invoices/${invoiceA.id}`, createFromInvoiceActionId, [invoiceA.id])
      const body = parseActionResult(res.text) as { success?: boolean; id?: string }
      record("B", "1/2. Generate Sales Ledger from Invoice succeeds", body.success === true, JSON.stringify(body))
      generatedEntryId = (body.id as string) ?? ""
      if (generatedEntryId) cleanupSalesLedgerIds.push(generatedEntryId)

      const listEntries = await getSalesLedgerEntries(companyA.id, {})
      const genRow = listEntries.find((e) => e.id === generatedEntryId)
      record("B", `3. Sales Ledger shows the real Invoice No ${invoiceA.invoiceNumber}`, !!genRow && resolveSalesLedgerInvoiceNo(genRow) === invoiceA.invoiceNumber, `resolved=${genRow ? resolveSalesLedgerInvoiceNo(genRow) : "n/a"}`)
      record("B", "4. Exactly one Invoice No source used (invoice relation present, no separate duplicate column in the data shape)", !!genRow?.invoice && genRow.invoice.invoiceNumber === invoiceA.invoiceNumber, `invoice=${JSON.stringify(genRow?.invoice)}`)

      const updateRes = await callAction(cookieA, "/ledger/sales", updateSalesActionId, [
        generatedEntryId,
        { date: "2026-01-11", customerId: customerA.id, customerName: "SLU Customer A Renamed", orderNo: "SHOULD-BE-IGNORED", invoiceAmount: 100000, amountReceived: 0, remark: "" },
      ])
      const updateBody = parseActionResult(updateRes.text) as { success?: boolean }
      const invoiceAfter = await prisma.invoice.findUnique({ where: { id: invoiceA.id }, select: { invoiceNumber: true } })
      const entryAfter = await prisma.salesLedgerEntry.findUnique({ where: { id: generatedEntryId }, select: { orderNo: true } })
      record("B", "5a. Editing the generated Sales Ledger entry succeeds", updateBody.success === true, JSON.stringify(updateBody))
      record("B", "5b. Original Invoice.invoiceNumber is untouched by the Sales Ledger edit", invoiceAfter?.invoiceNumber === invoiceA.invoiceNumber, `invoiceNumber=${invoiceAfter?.invoiceNumber}`)
      record("B", "5c. Generated entry's orderNo snapshot is frozen, not overwritten by the disabled form field", entryAfter?.orderNo === invoiceA.invoiceNumber, `orderNo=${entryAfter?.orderNo}`)
    }

    // ─── C. Search reaches both manual and invoice-generated Invoice No ───────
    console.log("\n=== C. Search ===")
    {
      const manualSearch = await getSalesLedgerEntries(companyA.id, { customerName: "TEST-INV-001" })
      record("C", "Search by manual Invoice No finds the manual record", manualSearch.some((e) => e.id === manualEntryId), `count=${manualSearch.length}`)

      const genSearch = await getSalesLedgerEntries(companyA.id, { customerName: invoiceA.invoiceNumber })
      record("C", "Search by invoice-generated Invoice No finds the generated record", genSearch.some((e) => e.id === generatedEntryId), `count=${genSearch.length}`)
    }

    // ─── D. Delete without receipts ────────────────────────────────────────────
    console.log("\n=== D. Delete without receipts ===")
    {
      const before = await prisma.salesLedgerEntry.findUnique({ where: { id: manualEntryId } })
      const res = await callAction(cookieA, "/ledger/sales", deleteSalesActionId, [manualEntryId])
      const body = parseActionResult(res.text) as { success?: boolean; error?: string }
      const after = await prisma.salesLedgerEntry.findUnique({ where: { id: manualEntryId } })
      record("D", "Delete succeeds for an unpaid manual entry with no receipts", body.success === true && !!before && after === null, JSON.stringify(body))
      if (after === null) cleanupSalesLedgerIds.splice(cleanupSalesLedgerIds.indexOf(manualEntryId), 1)
    }

    // ─── E. Delete blocked once a receipt has been allocated ──────────────────
    console.log("\n=== E. Delete blocked with receipts ===")
    let receiptLedgerEntryId = ""
    {
      const receiptRes = await callAction(cookieA, "/ledger/income-expense", createLedgerEntryActionId, [
        {
          type: "INCOME",
          categoryId: "__new__",
          newCategoryName: "SLU Receipts",
          date: "2026-01-12",
          amount: 20000,
          paymentMethod: "CASH",
          referenceNo: "SLU-RCPT-1",
          remark: "SLU receipt for E",
          customerId: customerA.id,
          allocations: [{ salesLedgerEntryId: generatedEntryId, amount: 20000 }],
        },
      ])
      const receiptBody = parseActionResult(receiptRes.text) as { success?: boolean }
      const receiptRow = await prisma.ledgerEntry.findFirst({ where: { companyId: companyA.id, remark: "SLU receipt for E" } })
      receiptLedgerEntryId = receiptRow?.id ?? ""
      if (receiptLedgerEntryId) cleanupLedgerEntryIds.push(receiptLedgerEntryId)
      record("E", "0. Receipt allocation against the generated entry succeeds (setup)", receiptBody.success === true && !!receiptRow, JSON.stringify(receiptBody))

      const entryWithReceipt = await prisma.salesLedgerEntry.findUnique({ where: { id: generatedEntryId }, include: { _count: { select: { allocations: true } } } })
      record("E", "0b. Entry now shows amountReceived > 0 / has allocations (setup)", Number(entryWithReceipt?.amountReceived) === 20000 && (entryWithReceipt?._count.allocations ?? 0) === 1, `amountReceived=${entryWithReceipt?.amountReceived} allocations=${entryWithReceipt?._count.allocations}`)

      const res = await callAction(cookieA, "/ledger/sales", deleteSalesActionId, [generatedEntryId])
      const body = parseActionResult(res.text) as { error?: string }
      record("E", "Delete is blocked with the HAS_PAYMENTS error code", body.error === "HAS_PAYMENTS", JSON.stringify(body))

      const [receiptStill, allocationStill, entryStill] = await Promise.all([
        prisma.ledgerEntry.findUnique({ where: { id: receiptLedgerEntryId } }),
        prisma.receiptAllocation.findFirst({ where: { salesLedgerEntryId: generatedEntryId } }),
        prisma.salesLedgerEntry.findUnique({ where: { id: generatedEntryId } }),
      ])
      record("E", "Receipt LedgerEntry remains intact", !!receiptStill, "")
      record("E", "ReceiptAllocation remains intact", !!allocationStill, "")
      record("E", "SalesLedgerEntry itself remains intact", !!entryStill, "")
    }

    // ─── F. Invoice-generated deletion never touches the Invoice ──────────────
    console.log("\n=== F. Invoice-generated deletion protects the Invoice ===")
    {
      // Undo E's receipt first so the entry is eligible for deletion again — mirrors
      // the real business flow (F is about a *different* eligible generated entry,
      // this reuses the same fixture rather than minting a second Invoice). Goes
      // through the real deleteLedgerEntry action (not a raw prisma.delete) so the
      // matching recomputeSalesLedgerEntry() actually runs and resets amountReceived.
      const deleteLedgerEntryActionId = await getActionId("(dashboard)/ledger/income-expense/page", "src/lib/actions/ledger.ts", "deleteLedgerEntry")
      if (deleteLedgerEntryActionId) {
        await callAction(cookieA, "/ledger/income-expense", deleteLedgerEntryActionId, [receiptLedgerEntryId])
        cleanupLedgerEntryIds.splice(cleanupLedgerEntryIds.indexOf(receiptLedgerEntryId), 1)
      }
      const entryAfterUndo = await prisma.salesLedgerEntry.findUnique({ where: { id: generatedEntryId } })
      record("F", "0. Setup: entry is back to amountReceived = 0 after removing the receipt via deleteLedgerEntry", Number(entryAfterUndo?.amountReceived) === 0, `amountReceived=${entryAfterUndo?.amountReceived}`)

      const res = await callAction(cookieA, "/ledger/sales", deleteSalesActionId, [generatedEntryId])
      const body = parseActionResult(res.text) as { success?: boolean }
      const entryGone = await prisma.salesLedgerEntry.findUnique({ where: { id: generatedEntryId } })
      const invoiceStill = await prisma.invoice.findUnique({ where: { id: invoiceA.id } })
      record("F", "SalesLedgerEntry removed", body.success === true && entryGone === null, JSON.stringify(body))
      record("F", "Invoice itself remains, unchanged", !!invoiceStill && invoiceStill.invoiceNumber === invoiceA.invoiceNumber, `invoiceNumber=${invoiceStill?.invoiceNumber}`)
      if (entryGone === null) cleanupSalesLedgerIds.splice(cleanupSalesLedgerIds.indexOf(generatedEntryId), 1)

      // Bonus: Invoice.salesLedgerEntry has no separate status flag — it's purely the
      // reverse of the unique invoiceId FK, so the Invoice must now be eligible again.
      const regenRes = await callAction(cookieA, `/quotations/invoices/${invoiceA.id}`, createFromInvoiceActionId, [invoiceA.id])
      const regenBody = parseActionResult(regenRes.text) as { success?: boolean; id?: string }
      record("F", "Bonus: Invoice is automatically eligible to generate a new Sales Ledger record again (no leftover flag)", regenBody.success === true, JSON.stringify(regenBody))
      if (regenBody.id) cleanupSalesLedgerIds.push(regenBody.id)
    }

    // ─── G. Statistics regression ──────────────────────────────────────────────
    console.log("\n=== G. Statistics regression ===")
    {
      const now = new Date()
      const thisMonthDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-15`
      const salesBefore = await getCurrentMonthSalesTotal(companyA.id)
      const incomeBefore = await getCurrentMonthSalesIncomeTotal(companyA.id)
      const balanceBefore = await getUnpaidSalesBalance(companyA.id)

      const res = await callAction(cookieA, "/ledger/sales", createSalesActionId, [
        { date: thisMonthDate, customerId: customerA.id, customerName: customerA.companyName, orderNo: "SLU-STATS-1", invoiceAmount: 7000, amountReceived: 0, remark: "SLU stats fixture" },
      ])
      const body = parseActionResult(res.text) as { success?: boolean }
      const statsRow = await prisma.salesLedgerEntry.findFirst({ where: { companyId: companyA.id, remark: "SLU stats fixture" } })
      if (statsRow) cleanupSalesLedgerIds.push(statsRow.id)

      const salesAfterCreate = await getCurrentMonthSalesTotal(companyA.id)
      const balanceAfterCreate = await getUnpaidSalesBalance(companyA.id)
      record("G", "Create fixture succeeds", body.success === true, "")
      record("G", "Current Month Sales increases by exactly the new entry's invoiceAmount", Math.abs(salesAfterCreate - salesBefore - 7000) < 0.01, `before=${salesBefore} after=${salesAfterCreate}`)
      record("G", "Total Outstanding Balance increases by exactly the new entry's balance", Math.abs(balanceAfterCreate - balanceBefore - 7000) < 0.01, `before=${balanceBefore} after=${balanceAfterCreate}`)

      if (statsRow) {
        const delRes = await callAction(cookieA, "/ledger/sales", deleteSalesActionId, [statsRow.id])
        const delBody = parseActionResult(delRes.text) as { success?: boolean }
        const salesAfterDelete = await getCurrentMonthSalesTotal(companyA.id)
        const incomeAfterDelete = await getCurrentMonthSalesIncomeTotal(companyA.id)
        record("G", "Deleting the (unpaid, unreceipted) fixture reduces Current Month Sales back to baseline", delBody.success === true && Math.abs(salesAfterDelete - salesBefore) < 0.01, `before=${salesBefore} after=${salesAfterDelete}`)
        record("G", "Current Month Income (cash-flow) is untouched throughout — this entry never received a payment", Math.abs(incomeAfterDelete - incomeBefore) < 0.01, `before=${incomeBefore} after=${incomeAfterDelete}`)
        if (delBody.success) cleanupSalesLedgerIds.splice(cleanupSalesLedgerIds.indexOf(statsRow.id), 1)
      }

      // Monthly Sales Statistics for the current year+month must still be queryable and consistent.
      const monthly = await getSalesLedgerMonthlyStatistics(companyA.id, now.getFullYear(), now.getMonth() + 1)
      record("G", "getSalesLedgerMonthlyStatistics still returns a well-formed single-month bucket", monthly.length === 1 && monthly[0].month === now.getMonth() + 1, JSON.stringify(monthly))
    }

    // ─── H. Security / permission regression ───────────────────────────────────
    console.log("\n=== H. Security regression ===")
    {
      // Fresh fixture for the permission/isolation checks below.
      const fixtureRes = await callAction(cookieA, "/ledger/sales", createSalesActionId, [
        { date: "2026-01-20", customerId: customerA.id, customerName: customerA.companyName, orderNo: "SLU-SEC-1", invoiceAmount: 3000, amountReceived: 0, remark: "SLU security fixture" },
      ])
      const fixtureBody = parseActionResult(fixtureRes.text) as { success?: boolean }
      const fixtureRow = await prisma.salesLedgerEntry.findFirst({ where: { companyId: companyA.id, remark: "SLU security fixture" } })
      if (fixtureRow) cleanupSalesLedgerIds.push(fixtureRow.id)
      record("H", "0. Setup fixture created", fixtureBody.success === true && !!fixtureRow, "")

      if (fixtureRow) {
        const cookieEditNoDelete = await login(editNoDeleteUser.name)
        const res = await callAction(cookieEditNoDelete, "/ledger/sales", deleteSalesActionId, [fixtureRow.id])
        const body = parseActionResult(res.text) as { error?: string }
        record("H", "1. ledger.sales.edit-only user is denied delete (Forbidden) — no permission expansion from the Archive->Delete change", body.error === "Forbidden", JSON.stringify(body))
        const stillThere = await prisma.salesLedgerEntry.findUnique({ where: { id: fixtureRow.id } })
        record("H", "1b. Forbidden delete attempt left the record untouched", !!stillThere, "")

        const cookieB = await login(adminB.name)
        const crossRes = await callAction(cookieB, "/ledger/sales", deleteSalesActionId, [fixtureRow.id])
        const crossBody = parseActionResult(crossRes.text) as { error?: string }
        record("H", "2. Cross-company delete attempt is denied (Record not found, tenant isolation)", crossBody.error === "Record not found", JSON.stringify(crossBody))

        const crossUpdateRes = await callAction(cookieB, "/ledger/sales", updateSalesActionId, [
          fixtureRow.id,
          { date: "2026-01-21", customerId: customerA.id, customerName: "Hijacked", orderNo: "HIJACK", invoiceAmount: 1, amountReceived: 0, remark: "" },
        ])
        const crossUpdateBody = parseActionResult(crossUpdateRes.text) as { error?: string }
        // The customerId ownership check runs before the entry's own companyId scoping,
        // so a cross-company update is denied at whichever check fires first — either
        // is a correct denial; 3b below is what actually proves no data leak occurred.
        record("H", "3. Cross-company edit attempt is denied (customerId or record ownership check)", crossUpdateBody.error === "Record not found" || crossUpdateBody.error === "Customer not found", JSON.stringify(crossUpdateBody))
        const untouched = await prisma.salesLedgerEntry.findUnique({ where: { id: fixtureRow.id } })
        record("H", "3b. Cross-company edit attempt did not modify the record", untouched?.customerName === customerA.companyName, `customerName=${untouched?.customerName}`)
      }
    }
  } finally {
    // ─── Cleanup — remove only what this run created ───────────────────────────
    if (cleanupLedgerEntryIds.length) await prisma.ledgerEntry.deleteMany({ where: { id: { in: cleanupLedgerEntryIds } } })
    if (cleanupSalesLedgerIds.length) await prisma.receiptAllocation.deleteMany({ where: { salesLedgerEntryId: { in: cleanupSalesLedgerIds } } })
    if (cleanupSalesLedgerIds.length) await prisma.salesLedgerEntry.deleteMany({ where: { id: { in: cleanupSalesLedgerIds } } })
    await prisma.invoice.deleteMany({ where: { id: invoiceA.id } })
    const testUserIds = [adminA.id, adminB.id, editNoDeleteUser.id]
    const testCompanyIds = [companyA.id, companyB.id]
    await prisma.auditLog.deleteMany({ where: { performedById: { in: testUserIds } } })
    await prisma.customer.deleteMany({ where: { id: customerA.id } })
    await prisma.user.deleteMany({ where: { id: { in: testUserIds } } })
    // The income-expense page hit by createLedgerEntry/deleteLedgerEntry seeds default
    // LedgerCategory rows for the company as a side effect of rendering — must clear
    // those before the company row itself can be deleted (FK).
    await prisma.ledgerCategory.deleteMany({ where: { companyId: { in: testCompanyIds } } })
    await prisma.company.deleteMany({ where: { id: { in: testCompanyIds } } })

    const finalSalesLedgerCount = await prisma.salesLedgerEntry.count()
    record("Z", "Pre-existing Sales Ledger records are untouched (count restored to baseline)", finalSalesLedgerCount === baselineSalesLedgerCount, `before=${baselineSalesLedgerCount} after=${finalSalesLedgerCount}`)
  }

  console.log("\n=== Summary ===")
  const passed = results.filter((r) => r.pass).length
  console.log(`Total checks: ${results.length}`)
  console.log(`Passed:       ${passed}`)
  console.log(`Failed:       ${results.length - passed}`)
  if (passed !== results.length) {
    console.log("\nFailed checks:")
    for (const r of results.filter((r) => !r.pass)) console.log(`  [${r.area}] ${r.description} — ${r.detail}`)
    process.exitCode = 1
  }
  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error("TEST SCRIPT FAILED:", err)
  await prisma.$disconnect()
  process.exit(1)
})

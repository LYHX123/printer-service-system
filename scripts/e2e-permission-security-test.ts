/**
 * Final Remediation Phase 1 — real E2E security test.
 *
 * Spins up an isolated Test Company (+ a second Company B for isolation
 * checks) with one user per persona, logs each one in over real HTTP against
 * a running dev server (real NextAuth session cookie, not a mocked session),
 * and exercises the actual pages + Server Actions to confirm the P0 fixes
 * hold from the outside. Cleans up all test data on exit unless --keep is
 * passed.
 *
 * Prerequisite: `npm run dev` must already be running on BASE_URL.
 * Run with: npx tsx scripts/e2e-permission-security-test.ts
 */
import "dotenv/config"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"
import bcrypt from "bcryptjs"
import { ALL_PERMISSIONS, PERMISSION_TREE } from "../src/lib/permissions"
import type { PartCategory } from "../src/types"
import { mkdir, writeFile, rm, readFile } from "fs/promises"
import path from "path"
import zlib from "node:zlib"
import sharp from "sharp"
import {
  createJob,
  updateJobStatus,
  assignEngineer,
  updateTechnicianNotes,
  saveJobSignature,
  declineSignature,
} from "../src/lib/actions/jobs"
import { saveRepairReport } from "../src/lib/actions/reports"
import type { JobInput } from "../src/lib/schemas"

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000"
const KEEP = process.argv.includes("--keep")

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const PASSWORD = "E2eTest!2026"

type Check = { area: string; description: string; pass: boolean; detail: string }
const results: Check[] = []
function record(area: string, description: string, pass: boolean, detail: string) {
  results.push({ area, description, pass, detail })
  console.log(`  [${pass ? "PASS" : "FAIL"}] ${description} — ${detail}`)
}

// ─── HTTP helpers ───────────────────────────────────────────────────────────

async function getCsrf(): Promise<{ csrfToken: string; cookie: string }> {
  const res = await fetch(`${BASE_URL}/api/auth/csrf`)
  const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0]
  const { csrfToken } = (await res.json()) as { csrfToken: string }
  return { csrfToken, cookie }
}

/** Real credentials sign-in against NextAuth's own callback endpoint — returns the session cookie header. */
async function login(name: string): Promise<string> {
  const { csrfToken, cookie: csrfCookie } = await getCsrf()
  const body = new URLSearchParams({
    name,
    password: PASSWORD,
    csrfToken,
    callbackUrl: `${BASE_URL}/dashboard`,
    json: "true",
  })
  const res = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: csrfCookie },
    body: body.toString(),
    redirect: "manual",
  })
  const setCookies = res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""]
  const sessionParts = setCookies.filter(Boolean).map((c) => c.split(";")[0])
  const merged = [csrfCookie, ...sessionParts].join("; ")
  // Sanity check: a real session must now resolve via /api/auth/session.
  const check = await fetch(`${BASE_URL}/api/auth/session`, { headers: { Cookie: merged } })
  const session = (await check.json()) as { user?: { name?: string } }
  if (!session?.user?.name) throw new Error(`Login failed for "${name}" — no session established`)
  return merged
}

/** GET a page and report whether it actually rendered (200) vs was denied (redirect / 4xx). */
async function getPage(cookie: string, path: string): Promise<{ status: number; redirected: boolean; location: string | null }> {
  const res = await fetch(`${BASE_URL}${path}`, { headers: { Cookie: cookie }, redirect: "manual" })
  return { status: res.status, redirected: res.status >= 300 && res.status < 400, location: res.headers.get("location") }
}

/** Invoke a real Next.js Server Action over HTTP using its build-time reference id (matches what the client bundle sends when a bound action is called directly, not via a plain <form>). */
async function callAction(cookie: string, pagePath: string, actionId: string, args: unknown[]): Promise<{ status: number; text: string }> {
  const res = await fetch(`${BASE_URL}${pagePath}`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      Accept: "text/x-component",
      "Content-Type": "text/plain;charset=UTF-8",
      "Next-Action": actionId,
    },
    body: JSON.stringify(args),
  })
  const text = await res.text()
  return { status: res.status, text }
}

/** True if the action's response indicates the server-side authorization check rejected the call (vs. actually performing the write). */
function wasForbidden(res: { status: number; text: string }): boolean {
  if (res.status === 403) return true
  return /"error"\s*:\s*"(Forbidden|Unauthorized)"/i.test(res.text)
}

/** Cross-company action attempts correctly fail as "not found" (findFirst({id, companyId}) scoping), not "Forbidden" — this accepts either. */
function wasBlockedOrNotFound(res: { status: number; text: string }): boolean {
  if (wasForbidden(res)) return true
  return /"error"\s*:\s*"[^"]*not found/i.test(res.text)
}

// ─── Test data setup ────────────────────────────────────────────────────────

async function main() {
  console.log(`E2E target: ${BASE_URL}\n`)
  const passwordHash = await bcrypt.hash(PASSWORD, 10)

  const companyA = await prisma.company.create({
    data: { name: "E2E Test Co", code: `E2E-A-${Date.now()}`, currency: "KES", timezone: "Africa/Nairobi" },
  })
  const companyB = await prisma.company.create({
    data: { name: "E2E Test Co B", code: `E2E-B-${Date.now()}`, currency: "KES", timezone: "Africa/Nairobi" },
  })

  async function makeUser(companyId: string, name: string, role: "ADMIN" | "MANAGER" | "RECEPTIONIST" | "ENGINEER", permissions: string[]) {
    return prisma.user.create({
      data: { companyId, name, passwordHash, role, modulePermissions: permissions, isActive: true },
      select: { id: true, name: true },
    })
  }

  const admin = await makeUser(companyA.id, `E2E Admin ${Date.now()}`, "ADMIN", [])
  const zeroPerm = await makeUser(companyA.id, `E2E ZeroPerm ${Date.now()}`, "RECEPTIONIST", [])
  const customerViewOnly = await makeUser(companyA.id, `E2E CustView ${Date.now()}`, "RECEPTIONIST", ["dashboard.view", "customers.view"])
  const stockEquipViewOnly = await makeUser(companyA.id, `E2E StockEquip ${Date.now()}`, "RECEPTIONIST", ["dashboard.view", "stock.equipment.view"])
  const stockConsumptionViewOnly = await makeUser(companyA.id, `E2E StockConsumption ${Date.now()}`, "RECEPTIONIST", ["dashboard.view", "stock.consumption.view"])
  const stockPartsViewOnly = await makeUser(companyA.id, `E2E StockParts ${Date.now()}`, "RECEPTIONIST", ["dashboard.view", "stock.parts.view"])
  const stockEquipAndConsumptionViewOnly = await makeUser(companyA.id, `E2E StockEquipConsumption ${Date.now()}`, "RECEPTIONIST", ["dashboard.view", "stock.equipment.view", "stock.consumption.view"])
  const quotationViewOnly = await makeUser(companyA.id, `E2E QuoteView ${Date.now()}`, "RECEPTIONIST", ["dashboard.view", "quotations.view"])
  const shopAccountOnly = await makeUser(companyA.id, `E2E ShopOnly ${Date.now()}`, "RECEPTIONIST", ["dashboard.view", "ledger.shop.view", "ledger.shop.create", "ledger.shop.edit"])
  const shopAccountViewOnly = await makeUser(companyA.id, `E2E ShopViewOnly ${Date.now()}`, "RECEPTIONIST", ["dashboard.view", "ledger.shop.view"])
  const ledgerOnly = await makeUser(companyA.id, `E2E LedgerOnly ${Date.now()}`, "RECEPTIONIST", ["dashboard.view", "ledger.general.view", "ledger.sales.view"])
  const salesLedgerCreateEditUser = await makeUser(companyA.id, `E2E SalesLedgerCreateEdit ${Date.now()}`, "RECEPTIONIST", ["dashboard.view", "ledger.sales.view", "ledger.sales.create", "ledger.sales.edit", "ledger.sales.export"])
  const ledgerCreateEditUser = await makeUser(companyA.id, `E2E LedgerCreateEdit ${Date.now()}`, "RECEPTIONIST", ["dashboard.view", "ledger.general.view", "ledger.general.create", "ledger.general.edit"])
  const managerNoUserPerm = await makeUser(companyA.id, `E2E MgrNoUserPerm ${Date.now()}`, "MANAGER", ["dashboard.view", "users.view"])
  const legacyFullAccess = await makeUser(companyA.id, `E2E LegacyFull ${Date.now()}`, "RECEPTIONIST", [...ALL_PERMISSIONS])
  const quotationEditOnly = await makeUser(companyA.id, `E2E QuoteEditOnly ${Date.now()}`, "RECEPTIONIST", ["dashboard.view", "quotations.view", "quotations.create", "quotations.edit"])
  const quotationApprover = await makeUser(companyA.id, `E2E QuoteApprover ${Date.now()}`, "RECEPTIONIST", ["dashboard.view", "quotations.view", "quotations.edit", "quotations.approve"])
  const invoiceViewOnly = await makeUser(companyA.id, `E2E InvoiceView ${Date.now()}`, "RECEPTIONIST", ["dashboard.view", "invoice.view"])
  const invoiceAndQuotationBoth = await makeUser(companyA.id, `E2E InvQuoteBoth ${Date.now()}`, "RECEPTIONIST", ["dashboard.view", "invoice.view", "quotations.view"])
  const invoiceCreateEditUser = await makeUser(companyA.id, `E2E InvoiceCreateEdit ${Date.now()}`, "RECEPTIONIST", ["dashboard.view", "invoice.view", "invoice.create", "invoice.edit"])
  const taskParticipant = await makeUser(companyA.id, `E2E TaskParticipant ${Date.now()}`, "RECEPTIONIST", ["dashboard.view", "tasks.view"])
  const taskCreatorUser = await makeUser(companyA.id, `E2E TaskCreator ${Date.now()}`, "MANAGER", ["dashboard.view", "tasks.view", "tasks.create"])
  // NOTE: the engineerA/engineerB/managerWithJobs personas that used to live here
  // (Final Remediation Phase 4 — Jobs Engineer-assigned-job ownership P1) were
  // removed as part of the Phase 5 Jobs decommission — see Section Q below for
  // the accounting of what replaced them.

  const companyBAdmin = await makeUser(companyB.id, `E2E CoB Admin ${Date.now()}`, "ADMIN", [])
  const companyBCustomer = await prisma.customer.create({
    data: { companyId: companyB.id, code: `E2EB-${Date.now()}`, companyName: "Company B Secret Customer", shortName: `CoBSecret${Date.now()}` },
  })

  const companyACustomer = await prisma.customer.create({
    data: { companyId: companyA.id, code: `E2EA-${Date.now()}`, companyName: "Company A Customer", shortName: `CoASecret${Date.now()}` },
  })

  const testQuotation = await prisma.quotation.create({
    data: {
      quotationNumber: `E2E-QT-${Date.now()}`,
      companyId: companyA.id,
      customerId: companyACustomer.id,
      createdById: admin.id,
      status: "SENT",
    },
    select: { id: true },
  })
  // Separate instance for the positive-control approve test (J) — status
  // transitions are one-way (SENT -> APPROVED is terminal), so this can't
  // share testQuotation with the negative D/quotationEditOnly checks above.
  const approvableQuotation = await prisma.quotation.create({
    data: {
      quotationNumber: `E2E-QT-APPR-${Date.now()}`,
      companyId: companyA.id,
      customerId: companyACustomer.id,
      createdById: admin.id,
      status: "SENT",
    },
    select: { id: true },
  })

  const testInvoice = await prisma.invoice.create({
    data: {
      invoiceNumber: `E2E-INV-${Date.now()}`,
      companyId: companyA.id,
      customerId: companyACustomer.id,
      createdById: admin.id,
      date: new Date(),
      subtotal: 0,
      vatPercent: 0,
      vatAmount: 0,
      totalAmount: 0,
    },
    select: { id: true },
  })

  const companyASparePart = await prisma.sparePart.create({
    data: {
      companyId: companyA.id,
      partNumber: `E2E-PART-A-${Date.now()}`,
      name: "E2E Company A Laptop Part",
      category: "LAPTOP_PART",
      brand: "E2E",
      unitCost: 1,
      sellingPrice: 1,
      reorderLevel: 1,
    },
    select: { id: true },
  })
  const companyBSparePart = await prisma.sparePart.create({
    data: {
      companyId: companyB.id,
      partNumber: `E2E-PART-B-${Date.now()}`,
      name: "E2E Company B Secret Part",
      category: "LAPTOP_PART",
      brand: "E2E",
      unitCost: 1,
      sellingPrice: 1,
      reorderLevel: 1,
    },
    select: { id: true },
  })

  const companyBQuotation = await prisma.quotation.create({
    data: {
      quotationNumber: `E2E-QT-B-${Date.now()}`,
      companyId: companyB.id,
      customerId: companyBCustomer.id,
      createdById: companyBAdmin.id,
      status: "SENT",
    },
    select: { id: true },
  })

  const companyBInvoice = await prisma.invoice.create({
    data: {
      invoiceNumber: `E2E-INV-B-${Date.now()}`,
      companyId: companyB.id,
      customerId: companyBCustomer.id,
      createdById: companyBAdmin.id,
      date: new Date(),
      subtotal: 0,
      vatPercent: 0,
      vatAmount: 0,
      totalAmount: 0,
    },
    select: { id: true },
  })

  const companyBTask = await prisma.task.create({
    data: { companyId: companyB.id, title: "E2E Company B Secret Task", createdById: companyBAdmin.id },
    select: { id: true },
  })
  const companyATask = await prisma.task.create({
    data: { companyId: companyA.id, title: "E2E Company A Task", createdById: taskParticipant.id },
    select: { id: true },
  })
  const companyATaskStep = await prisma.taskStep.create({
    data: { taskId: companyATask.id, title: "Step 1", order: 1, createdById: taskParticipant.id },
    select: { id: true },
  })
  const companyBTaskStep = await prisma.taskStep.create({
    data: { taskId: companyBTask.id, title: "Step 1", order: 1, createdById: companyBAdmin.id },
    select: { id: true },
  })

  // Fixtures for upload-authorization tests (P0 fix — Final Remediation Phase 2).
  const companyAQuotationItem = await prisma.quotationItem.create({
    data: { quotationId: testQuotation.id, partId: companyASparePart.id, unitPrice: 1, subtotal: 1 },
    select: { id: true },
  })
  const companyBQuotationItem = await prisma.quotationItem.create({
    data: { quotationId: companyBQuotation.id, partId: companyBSparePart.id, unitPrice: 1, subtotal: 1 },
    select: { id: true },
  })
  const companyAEquipment = await prisma.equipment.create({
    data: { companyId: companyA.id, customerId: companyACustomer.id, serialNumber: `E2E-SN-A-${Date.now()}`, brand: "E2E", model: "X1", type: "PRINTER" },
    select: { id: true },
  })
  const companyBEquipment = await prisma.equipment.create({
    data: { companyId: companyB.id, customerId: companyBCustomer.id, serialNumber: `E2E-SN-B-${Date.now()}`, brand: "E2E", model: "X1", type: "PRINTER" },
    select: { id: true },
  })
  const companyAJob = await prisma.serviceJob.create({
    data: {
      companyId: companyA.id, customerId: companyACustomer.id, equipmentId: companyAEquipment.id,
      jobNumber: `E2E-JOB-A-${Date.now()}`, serviceType: "REPAIR", assignedToId: admin.id, createdById: admin.id, problemDesc: "E2E test job",
    },
    select: { id: true },
  })
  const companyBJob = await prisma.serviceJob.create({
    data: {
      companyId: companyB.id, customerId: companyBCustomer.id, equipmentId: companyBEquipment.id,
      jobNumber: `E2E-JOB-B-${Date.now()}`, serviceType: "REPAIR", assignedToId: companyBAdmin.id, createdById: companyBAdmin.id, problemDesc: "E2E test job",
    },
    select: { id: true },
  })
  // Fixtures for the Jobs decommission verification (Final Remediation Phase 5)
  // — a Quotation with a linked (converted) ServiceJob, and an InventoryTransaction
  // linked to that same job, so Section Q can prove the two historical UI
  // references (Quotation's "Converted to Job" banner, Stock Reports' Job
  // column) still show the identifier as plain text but never link into the
  // now-decommissioned /jobs/** pages.
  const quotationForJobLink = await prisma.quotation.create({
    data: {
      quotationNumber: `E2E-QT-JOBLINK-${Date.now()}`,
      companyId: companyA.id,
      customerId: companyACustomer.id,
      createdById: admin.id,
      status: "SENT",
    },
    select: { id: true },
  })
  const jobForQuotationLink = await prisma.serviceJob.create({
    data: {
      companyId: companyA.id, customerId: companyACustomer.id, equipmentId: companyAEquipment.id,
      quotationId: quotationForJobLink.id,
      jobNumber: `E2E-JOB-LINK-${Date.now()}`, serviceType: "REPAIR", assignedToId: admin.id, createdById: admin.id, problemDesc: "E2E job-link fixture",
    },
    select: { id: true, jobNumber: true },
  })
  const sparePartForJobLink = await prisma.sparePart.create({
    data: {
      companyId: companyA.id, partNumber: `E2E-PART-JOBLINK-${Date.now()}`, name: "E2E Job Link Part",
      category: "GENERAL", brand: "E2E", unitCost: 1, sellingPrice: 1, reorderLevel: 1,
    },
    select: { id: true },
  })
  await prisma.inventoryTransaction.create({
    data: {
      companyId: companyA.id, part: { connect: { id: sparePartForJobLink.id } }, job: { connect: { id: jobForQuotationLink.id } },
      type: "IN", quantity: 1, performedBy: { connect: { id: admin.id } },
    },
  })

  console.log(`Created test company ${companyA.id} (A) and ${companyB.id} (B) with ${21} + ${1} users.\n`)

  // ─── A. Zero Permission ───────────────────────────────────────────────────
  console.log("=== A. Zero Permission user ===")
  {
    const cookie = await login(zeroPerm.name)
    for (const path of ["/customers", "/stock", "/quotations", "/quotations/invoices", "/ledger", "/ledger/sales", "/ledger/shop", "/tasks", "/users", "/settings"]) {
      const r = await getPage(cookie, path)
      record("A", `zero-permission GET ${path}`, r.status !== 200, `status=${r.status} location=${r.location}`)
    }
  }

  // ─── B. Customer View Only ────────────────────────────────────────────────
  console.log("\n=== B. Customer View Only ===")
  {
    const cookie = await login(customerViewOnly.name)
    const view = await getPage(cookie, "/customers")
    record("B", "customer-view-only GET /customers", view.status === 200, `status=${view.status}`)

    const manifest = await getActionId("(dashboard)/customers/page", "src/lib/actions/customers.ts", "setCustomerActive")
    if (manifest) {
      const res = await callAction(cookie, "/customers", manifest, [companyACustomer.id, false])
      record("B", "customer-view-only setCustomerActive (deactivate)", wasForbidden(res), res.text.slice(0, 200))
    } else {
      record("B", "customer-view-only setCustomerActive (deactivate)", false, "could not resolve action id — see manual note in report")
    }
  }

  // ─── C. Stock Equipment View Only ─────────────────────────────────────────
  console.log("\n=== C. Stock Equipment View Only ===")
  {
    const cookie = await login(stockEquipViewOnly.name)
    const equip = await getPage(cookie, "/stock?type=EQUIPMENT")
    record("C", "equip-view-only GET /stock?type=EQUIPMENT", equip.status === 200, `status=${equip.status}`)
    const consumption = await getPage(cookie, "/stock?type=CONSUMPTION")
    record("C", "equip-view-only GET /stock?type=CONSUMPTION", consumption.status !== 200, `status=${consumption.status} location=${consumption.location}`)
    const parts = await getPage(cookie, "/stock?type=PARTS")
    record("C", "equip-view-only GET /stock?type=PARTS", parts.status !== 200, `status=${parts.status} location=${parts.location}`)
    const newConsumption = await getPage(cookie, "/stock/new?type=CONSUMPTION")
    record("C", "equip-view-only GET /stock/new?type=CONSUMPTION", newConsumption.status !== 200, `status=${newConsumption.status} location=${newConsumption.location}`)

    const createActionId = await getActionId("(dashboard)/stock/new/page", "src/lib/actions/inventory.ts", "createSparePart")
    if (createActionId) {
      const res = await callAction(cookie, "/stock/new?type=CONSUMPTION", createActionId, [
        { name: "E2E Sneaky Toner", brand: "E2E", category: "TONER", unitCost: 1, sellingPrice: 1, reorderLevel: 1, quantity: 0 },
      ])
      record("C", "equip-view-only createSparePart(category=TONER/Consumption)", wasForbidden(res), res.text.slice(0, 200))
    } else {
      record("C", "equip-view-only createSparePart(category=TONER/Consumption)", false, "could not resolve action id")
    }
  }

  // ─── D. Quotation View Only ────────────────────────────────────────────────
  console.log("\n=== D. Quotation View Only ===")
  {
    const cookie = await login(quotationViewOnly.name)
    const view = await getPage(cookie, "/quotations")
    record("D", "quotation-view-only GET /quotations", view.status === 200, `status=${view.status}`)
    const newQuote = await getPage(cookie, "/quotations/new")
    record("D", "quotation-view-only GET /quotations/new", newQuote.status !== 200, `status=${newQuote.status} location=${newQuote.location}`)

    const approveActionId = await getActionId("(dashboard)/quotations/[id]/page", "src/lib/actions/quotations.ts", "updateQuotationStatus")
    if (approveActionId) {
      const res = await callAction(cookie, `/quotations/${testQuotation.id}`, approveActionId, [testQuotation.id, { toStatus: "APPROVED", note: "" }])
      record("D", "quotation-view-only updateQuotationStatus(-> APPROVED)", wasForbidden(res), res.text.slice(0, 200))
      const stillSent = await prisma.quotation.findUnique({ where: { id: testQuotation.id }, select: { status: true } })
      record("D", "DB check: quotation still SENT (not approved)", stillSent?.status === "SENT", `status=${stillSent?.status}`)
    } else {
      record("D", "quotation-view-only updateQuotationStatus(-> APPROVED)", false, "could not resolve action id")
    }
  }

  // ─── E. Shop Account Only ──────────────────────────────────────────────────
  console.log("\n=== E. Shop Account Only ===")
  {
    const cookie = await login(shopAccountOnly.name)
    const shop = await getPage(cookie, "/ledger/shop")
    record("E", "shop-only GET /ledger/shop", shop.status === 200, `status=${shop.status}`)
    const ledger = await getPage(cookie, "/ledger")
    record("E", "shop-only GET /ledger", ledger.status !== 200, `status=${ledger.status} location=${ledger.location}`)
    const sales = await getPage(cookie, "/ledger/sales")
    record("E", "shop-only GET /ledger/sales", sales.status !== 200, `status=${sales.status} location=${sales.location}`)
    const incomeExpense = await getPage(cookie, "/ledger/income-expense")
    record("E", "shop-only GET /ledger/income-expense", incomeExpense.status !== 200, `status=${incomeExpense.status} location=${incomeExpense.location}`)
  }

  // ─── F. Ledger Only ─────────────────────────────────────────────────────────
  console.log("\n=== F. Ledger Only (general+sales, no shop) ===")
  {
    const cookie = await login(ledgerOnly.name)
    const ledger = await getPage(cookie, "/ledger")
    record("F", "ledger-only GET /ledger", ledger.status === 200, `status=${ledger.status}`)
    const shop = await getPage(cookie, "/ledger/shop")
    record("F", "ledger-only GET /ledger/shop", shop.status !== 200, `status=${shop.status} location=${shop.location}`)
  }

  // ─── G. Privilege escalation ────────────────────────────────────────────────
  console.log("\n=== G. Privilege escalation (users.view only, no users.permissions.manage) ===")
  {
    const cookie = await login(managerNoUserPerm.name)
    const usersView = await getPage(cookie, "/users")
    record("G", "users.view-only GET /users (should still see the list)", usersView.status === 200, `status=${usersView.status}`)

    const roleActionId = await getActionId("(dashboard)/users/page", "src/lib/actions/users.ts", "updateUserRole")
    if (roleActionId) {
      const res = await callAction(cookie, "/users", roleActionId, [managerNoUserPerm.id, { role: "ADMIN" }])
      record("G", "users.view-only updateUserRole(self -> ADMIN)", wasForbidden(res), res.text.slice(0, 200))
      const stillManager = await prisma.user.findUnique({ where: { id: managerNoUserPerm.id }, select: { role: true } })
      record("G", "DB check: role unchanged after escalation attempt", stillManager?.role === "MANAGER", `role=${stillManager?.role}`)
    } else {
      record("G", "users.view-only updateUserRole(self -> ADMIN)", false, "could not resolve action id — see manual note in report")
    }

    const permActionId = await getActionId("(dashboard)/users/page", "src/lib/actions/users.ts", "updateUserPermissions")
    if (permActionId) {
      const res = await callAction(cookie, "/users", permActionId, [managerNoUserPerm.id, { modulePermissions: ["dashboard.view", "users.view", "users.permissions.manage"] }])
      record("G", "users.view-only updateUserPermissions(self, add users.permissions.manage)", wasForbidden(res), res.text.slice(0, 200))
      const stillNoManage = await prisma.user.findUnique({ where: { id: managerNoUserPerm.id }, select: { modulePermissions: true } })
      record("G", "DB check: permissions unchanged after escalation attempt", !stillNoManage?.modulePermissions.includes("users.permissions.manage"), `permissions=${stillNoManage?.modulePermissions}`)
    } else {
      record("G", "users.view-only updateUserPermissions(self, add users.permissions.manage)", false, "could not resolve action id — see manual note in report")
    }
  }

  // ─── H. Company isolation ───────────────────────────────────────────────────
  console.log("\n=== H. Company isolation ===")
  {
    const cookieA = await login(admin.name)
    const detail = await getPage(cookieA, `/customers/${companyBCustomer.id}`)
    record("H", "Company A admin GET Company B customer detail", detail.status !== 200, `status=${detail.status} location=${detail.location}`)

    const cookieB = await login(companyBAdmin.name)
    const detailReverse = await getPage(cookieB, `/customers/${companyACustomer.id}`)
    record("H", "Company B admin GET Company A customer detail", detailReverse.status !== 200, `status=${detailReverse.status} location=${detailReverse.location}`)

    // Stock, Quotation, Invoice detail pages — same cross-company GET pattern, both directions.
    const stockCross = await getPage(cookieA, `/stock/${companyBSparePart.id}/edit`)
    record("H", "Company A admin GET Company B stock item edit", stockCross.status !== 200, `status=${stockCross.status} location=${stockCross.location}`)
    const stockCrossReverse = await getPage(cookieB, `/stock/${companyASparePart.id}/edit`)
    record("H", "Company B admin GET Company A stock item edit", stockCrossReverse.status !== 200, `status=${stockCrossReverse.status} location=${stockCrossReverse.location}`)
    const quoteCross = await getPage(cookieA, `/quotations/${companyBQuotation.id}`)
    record("H", "Company A admin GET Company B quotation detail", quoteCross.status !== 200, `status=${quoteCross.status} location=${quoteCross.location}`)
    const invoiceCross = await getPage(cookieA, `/quotations/invoices/${companyBInvoice.id}`)
    record("H", "Company A admin GET Company B invoice detail", invoiceCross.status !== 200, `status=${invoiceCross.status} location=${invoiceCross.location}`)

    // Task and User have no per-entity page route — cross-company isolation is
    // enforced in the server action itself (findFirst({id, companyId})), so
    // exercise that directly instead of a GET.
    const completeTaskId = await getActionId("(dashboard)/tasks/page", "src/lib/actions/tasks.ts", "completeTask")
    if (completeTaskId) {
      const res = await callAction(cookieA, "/tasks", completeTaskId, [companyBTask.id])
      record("H", "Company A admin completeTask(Company B task)", wasBlockedOrNotFound(res), res.text.slice(0, 200))
      const stillActive = await prisma.task.findUnique({ where: { id: companyBTask.id }, select: { status: true } })
      record("H", "DB check: Company B task unaffected", stillActive?.status === "ACTIVE", `status=${stillActive?.status}`)
    } else {
      record("H", "Company A admin completeTask(Company B task)", false, "could not resolve action id")
    }

    const updateRoleId = await getActionId("(dashboard)/users/page", "src/lib/actions/users.ts", "updateUserRole")
    if (updateRoleId) {
      const res = await callAction(cookieA, "/users", updateRoleId, [companyBAdmin.id, { role: "RECEPTIONIST" }])
      record("H", "Company A admin updateUserRole(Company B admin)", wasBlockedOrNotFound(res), res.text.slice(0, 200))
      const stillAdmin = await prisma.user.findUnique({ where: { id: companyBAdmin.id }, select: { role: true } })
      record("H", "DB check: Company B admin role unaffected", stillAdmin?.role === "ADMIN", `role=${stillAdmin?.role}`)
    } else {
      record("H", "Company A admin updateUserRole(Company B admin)", false, "could not resolve action id")
    }
  }

  // ─── I. Legacy Full-Access Non-Admin (explicit ALL_PERMISSIONS, simulating a backfilled account) ───
  console.log("\n=== I. Legacy Full-Access Non-Admin ===")
  {
    const cookie = await login(legacyFullAccess.name)
    for (const path of ["/customers", "/stock", "/quotations", "/quotations/invoices", "/ledger", "/ledger/sales", "/ledger/shop", "/tasks", "/users", "/settings"]) {
      const r = await getPage(cookie, path)
      record("I", `legacy-full-access GET ${path}`, r.status === 200, `status=${r.status}`)
    }
  }

  // ─── J. Quotation edit != approve ─────────────────────────────────────────
  console.log("\n=== J. quotations.edit does not imply quotations.approve ===")
  {
    const approveActionId = await getActionId("(dashboard)/quotations/[id]/page", "src/lib/actions/quotations.ts", "updateQuotationStatus")

    // Negative: edit-only (no approve) must be rejected.
    const editOnlyCookie = await login(quotationEditOnly.name)
    if (approveActionId) {
      const res = await callAction(editOnlyCookie, `/quotations/${testQuotation.id}`, approveActionId, [testQuotation.id, { toStatus: "APPROVED", note: "" }])
      record("J", "quotations.edit-only updateQuotationStatus(-> APPROVED)", wasForbidden(res), res.text.slice(0, 200))
      const stillSent = await prisma.quotation.findUnique({ where: { id: testQuotation.id }, select: { status: true } })
      record("J", "DB check: quotation still SENT after edit-only attempt", stillSent?.status === "SENT", `status=${stillSent?.status}`)
    } else {
      record("J", "quotations.edit-only updateQuotationStatus(-> APPROVED)", false, "could not resolve action id")
    }

    // Positive control: a user WITH quotations.approve must succeed (proves this isn't a blanket lockout).
    const approverCookie = await login(quotationApprover.name)
    if (approveActionId) {
      const res = await callAction(approverCookie, `/quotations/${approvableQuotation.id}`, approveActionId, [approvableQuotation.id, { toStatus: "APPROVED", note: "" }])
      record("J", "quotations.approve holder updateQuotationStatus(-> APPROVED)", !wasForbidden(res) && res.status === 200, res.text.slice(0, 200))
      const nowApproved = await prisma.quotation.findUnique({ where: { id: approvableQuotation.id }, select: { status: true } })
      record("J", "DB check: quotation now APPROVED", nowApproved?.status === "APPROVED", `status=${nowApproved?.status}`)
    } else {
      record("J", "quotations.approve holder updateQuotationStatus(-> APPROVED)", false, "could not resolve action id")
    }
  }

  // ─── K. Dashboard content scoping ──────────────────────────────────────────
  console.log("\n=== K. Dashboard content scoping ===")
  {
    const zeroCookie = await login(zeroPerm.name)
    const zeroDash = await fetch(`${BASE_URL}/dashboard`, { headers: { Cookie: zeroCookie } })
    const zeroHtml = await zeroDash.text()
    record("K", "zero-permission dashboard has no /customers link", !zeroHtml.includes('href="/customers"'), `status=${zeroDash.status}`)
    record("K", "zero-permission dashboard has no /stock link", !zeroHtml.includes('href="/stock"'), `status=${zeroDash.status}`)
    record("K", "zero-permission dashboard has no /ledger link", !zeroHtml.includes('href="/ledger"'), `status=${zeroDash.status}`)

    const adminCookie = await login(admin.name)
    const adminDash = await fetch(`${BASE_URL}/dashboard`, { headers: { Cookie: adminCookie } })
    const adminHtml = await adminDash.text()
    record("K", "admin dashboard DOES have /customers link", adminHtml.includes('href="/customers"'), `status=${adminDash.status}`)

    const shopCookie = await login(shopAccountOnly.name)
    const shopDash = await fetch(`${BASE_URL}/dashboard`, { headers: { Cookie: shopCookie } })
    const shopHtml = await shopDash.text()
    record("K", "shop-only dashboard has no /ledger (general/sales) financial overview link", !shopHtml.includes('href="/ledger"'), `status=${shopDash.status}`)
  }

  // ─── M. Invoice basic checks ───────────────────────────────────────────────
  console.log("\n=== M. Invoice View Only ===")
  {
    const cookie = await login(invoiceViewOnly.name)
    const list = await getPage(cookie, "/quotations/invoices")
    record("M", "invoice-view-only GET /quotations/invoices", list.status === 200, `status=${list.status}`)
    const detail = await getPage(cookie, `/quotations/invoices/${testInvoice.id}`)
    record("M", "invoice-view-only GET invoice detail (own company)", detail.status === 200, `status=${detail.status}`)
    const newInvoice = await getPage(cookie, "/quotations/invoices/new")
    record("M", "invoice-view-only GET /quotations/invoices/new", newInvoice.status !== 200, `status=${newInvoice.status} location=${newInvoice.location}`)

    const createActionId = await getActionId("(dashboard)/quotations/invoices/new/page", "src/lib/actions/invoices.ts", "createDirectInvoice")
    if (createActionId) {
      const res = await callAction(cookie, "/quotations/invoices/new", createActionId, [
        { customerId: companyACustomer.id, date: new Date().toISOString().slice(0, 10), items: [], vatPercent: 0 },
      ])
      record("M", "invoice-view-only createDirectInvoice", wasForbidden(res), res.text.slice(0, 200))
    } else {
      record("M", "invoice-view-only createDirectInvoice", false, "could not resolve action id")
    }
  }

  // ─── N. Invoice/Quotation edge-routing boundary (Phase 2 regression fix) ───
  // /quotations/invoices/* is nested under /quotations/* on the URL tree but
  // belongs to the invoice.* module, not quotations. — the exact collision
  // src/auth.config.ts's findModuleMatch() must resolve correctly.
  console.log("\n=== N. Invoice/Quotation module routing boundary ===")
  {
    // N-A: invoice.*-only — Invoice ALLOW, Quotation DENY.
    const invCookie = await login(invoiceViewOnly.name)
    const invToInvoices = await getPage(invCookie, "/quotations/invoices")
    record("N", "invoice-only GET /quotations/invoices", invToInvoices.status === 200, `status=${invToInvoices.status}`)
    const invToInvoiceDetail = await getPage(invCookie, `/quotations/invoices/${testInvoice.id}`)
    record("N", "invoice-only GET /quotations/invoices/[id]", invToInvoiceDetail.status === 200, `status=${invToInvoiceDetail.status}`)
    const invToQuotations = await getPage(invCookie, "/quotations")
    record("N", "invoice-only GET /quotations (must DENY)", invToQuotations.status !== 200, `status=${invToQuotations.status} location=${invToQuotations.location}`)
    const invToQuotationsNew = await getPage(invCookie, "/quotations/new")
    record("N", "invoice-only GET /quotations/new (must DENY)", invToQuotationsNew.status !== 200, `status=${invToQuotationsNew.status} location=${invToQuotationsNew.location}`)
    const invToQuotationDetail = await getPage(invCookie, `/quotations/${testQuotation.id}`)
    record("N", "invoice-only GET /quotations/[id] (must DENY)", invToQuotationDetail.status !== 200, `status=${invToQuotationDetail.status} location=${invToQuotationDetail.location}`)

    // N-B: quotations.*-only — Quotation ALLOW, Invoice DENY.
    const quoteCookie = await login(quotationViewOnly.name)
    const quoteToQuotations = await getPage(quoteCookie, "/quotations")
    record("N", "quotations-only GET /quotations", quoteToQuotations.status === 200, `status=${quoteToQuotations.status}`)
    const quoteToInvoices = await getPage(quoteCookie, "/quotations/invoices")
    record("N", "quotations-only GET /quotations/invoices (must DENY)", quoteToInvoices.status !== 200, `status=${quoteToInvoices.status} location=${quoteToInvoices.location}`)
    const quoteToInvoiceDetail = await getPage(quoteCookie, `/quotations/invoices/${testInvoice.id}`)
    record("N", "quotations-only GET /quotations/invoices/[id] (must DENY)", quoteToInvoiceDetail.status !== 200, `status=${quoteToInvoiceDetail.status} location=${quoteToInvoiceDetail.location}`)

    // N-C: both — both ALLOW.
    const bothCookie = await login(invoiceAndQuotationBoth.name)
    const bothQuotations = await getPage(bothCookie, "/quotations")
    record("N", "invoice+quotations GET /quotations", bothQuotations.status === 200, `status=${bothQuotations.status}`)
    const bothInvoices = await getPage(bothCookie, "/quotations/invoices")
    record("N", "invoice+quotations GET /quotations/invoices", bothInvoices.status === 200, `status=${bothInvoices.status}`)

    // N-D: zero permission — both DENY.
    const zeroCookie2 = await login(zeroPerm.name)
    const zeroQuotations = await getPage(zeroCookie2, "/quotations")
    record("N", "zero-permission GET /quotations (must DENY)", zeroQuotations.status !== 200, `status=${zeroQuotations.status}`)
    const zeroInvoices = await getPage(zeroCookie2, "/quotations/invoices")
    record("N", "zero-permission GET /quotations/invoices (must DENY)", zeroInvoices.status !== 200, `status=${zeroInvoices.status}`)

    // N-E: Admin — both ALLOW.
    const adminCookie2 = await login(admin.name)
    const adminQuotations = await getPage(adminCookie2, "/quotations")
    record("N", "admin GET /quotations", adminQuotations.status === 200, `status=${adminQuotations.status}`)
    const adminInvoices = await getPage(adminCookie2, "/quotations/invoices")
    record("N", "admin GET /quotations/invoices", adminInvoices.status === 200, `status=${adminInvoices.status}`)
  }

  // ─── O. Upload file authorization (Phase 2 P0 fix) ─────────────────────────
  console.log("\n=== O. Upload file authorization ===")
  {
    // Real files on disk for Company A's fixtures so ALLOW checks hit a
    // genuine 200 — the authorizer runs before the filesystem read either
    // way, so cross-company DENY checks below don't need a Company B file
    // to exist to prove the block (and deliberately don't get one, for the
    // spare-part case, to prove denial isn't just "file happens to be missing").
    const logoPath = `companies/${companyA.id}/logo.png`
    const sparePartPath = `spareparts/${companyASparePart.id}/image.jpg`
    const quoteItemPath = `quotations/items/${companyAQuotationItem.id}/picture.jpg`
    const taskStepPath = `tasks/steps/${companyATaskStep.id}/test.jpg`
    const jobPhotoPath = `jobs/${companyAJob.id}/photos/test.jpg`
    await writeTestUploadFile(logoPath)
    await writeTestUploadFile(sparePartPath)
    await writeTestUploadFile(quoteItemPath)
    await writeTestUploadFile(taskStepPath)
    await writeTestUploadFile(jobPhotoPath)

    // -- Unauthenticated: every category must DENY (401), not serve the file.
    for (const [label, p] of [
      ["logo", logoPath], ["spare part", sparePartPath], ["quotation item", quoteItemPath],
      ["task step", taskStepPath], ["job photo", jobPhotoPath],
    ] as const) {
      const r = await getUpload(null, `/uploads/${p}`)
      record("O", `unauthenticated GET ${label}`, r.status === 401, `status=${r.status}`)
    }

    // -- Same-company, authorized -> ALLOW.
    const adminCookie3 = await login(admin.name)
    record("O", "admin GET own-company logo", (await getUpload(adminCookie3, `/uploads/${logoPath}`)).status === 200, "")
    // Was previously "-> 200" (same-company ALLOW), like every other row here — now
    // intentionally "-> 404" since Final Remediation Phase 6 (Legacy Jobs Decommission
    // — protected-upload closure) denies the entire jobs/** namespace unconditionally,
    // even for ADMIN, even with a real file on disk. See Section Q for the full
    // ADMIN/ENGINEER/unauthenticated/cross-company matrix this now belongs to.
    record("O", "admin GET own-company job photo -> 404 (jobs namespace closed, Phase 6)", (await getUpload(adminCookie3, `/uploads/${jobPhotoPath}`)).status === 404, "")

    const equipCookie = await login(stockEquipViewOnly.name)
    record("O", "stock.equipment.view GET own-company equipment-bucket spare part image", (await getUpload(equipCookie, `/uploads/${sparePartPath}`)).status === 200, "")

    const quoteCookie2 = await login(quotationViewOnly.name)
    record("O", "quotations.view GET own-company quotation item picture", (await getUpload(quoteCookie2, `/uploads/${quoteItemPath}`)).status === 200, "")

    const participantCookie = await login(taskParticipant.name)
    record("O", "task participant GET own task's step image", (await getUpload(participantCookie, `/uploads/${taskStepPath}`)).status === 200, "")

    const zeroCookie3 = await login(zeroPerm.name)
    record("O", "any authenticated same-company user GET logo (no permission required)", (await getUpload(zeroCookie3, `/uploads/${logoPath}`)).status === 200, "")

    // -- Same-company, but missing the relevant module permission -> DENY (403).
    record("O", "quotations.view (no stock.*) GET spare part image", (await getUpload(quoteCookie2, `/uploads/${sparePartPath}`)).status === 403, "")
    record("O", "customers-view-only (no quotations.*) GET quotation item picture", (await getUpload(await login(customerViewOnly.name), `/uploads/${quoteItemPath}`)).status === 403, "")
    record("O", "zero-permission (no tasks.*) GET task step image", (await getUpload(zeroCookie3, `/uploads/${taskStepPath}`)).status === 403, "")

    // -- Cross-company -> DENY (404), same as "doesn't exist" — never distinguishable.
    const cookieB2 = await login(companyBAdmin.name)
    record("O", "Company B admin GET Company A logo", (await getUpload(cookieB2, `/uploads/${logoPath}`)).status === 404, "")
    record("O", "Company B admin GET Company A spare part image", (await getUpload(cookieB2, `/uploads/${sparePartPath}`)).status === 404, "")
    record("O", "Company B admin GET Company A quotation item picture", (await getUpload(cookieB2, `/uploads/${quoteItemPath}`)).status === 404, "")
    record("O", "Company B admin GET Company A task step image", (await getUpload(cookieB2, `/uploads/${taskStepPath}`)).status === 404, "")
    record("O", "Company B admin GET Company A job photo", (await getUpload(cookieB2, `/uploads/${jobPhotoPath}`)).status === 404, "")
    // Reverse direction, and Company B's spare part path has no file on disk at
    // all — proving the block is the authorization check, not a missing file.
    record("O", "Company A admin GET Company B spare part image (no file on disk either)", (await getUpload(adminCookie3, `/uploads/spareparts/${companyBSparePart.id}/image.jpg`)).status === 404, "")
    record("O", "Company A admin GET Company B quotation item picture", (await getUpload(adminCookie3, `/uploads/quotations/items/${companyBQuotationItem.id}/picture.jpg`)).status === 404, "")
    record("O", "Company A admin GET Company B task step image", (await getUpload(adminCookie3, `/uploads/tasks/steps/${companyBTaskStep.id}/test.jpg`)).status === 404, "")
    record("O", "Company A admin GET Company B job photo", (await getUpload(adminCookie3, `/uploads/jobs/${companyBJob.id}/photos/test.jpg`)).status === 404, "")

    // -- Unknown/unclassified path -> fail closed (404), not served just because a file happens to exist.
    await writeTestUploadFile("mystery-namespace/secret.txt")
    record("O", "unknown path classification fails closed (admin, file exists on disk)", (await getUpload(adminCookie3, "/uploads/mystery-namespace/secret.txt")).status === 404, "")

    // -- Path traversal: still blocked (auth must not replace path validation).
    record("O", "traversal ../ literal segment", (await getUpload(adminCookie3, `/uploads/spareparts/../../../etc/passwd`)).status === 404, "")
    record("O", "traversal encoded %2e%2e", (await getUpload(adminCookie3, `/uploads/spareparts/%2e%2e/%2e%2e/package.json`)).status === 404, "")
    record("O", "traversal double-encoded %252e%252e", (await getUpload(adminCookie3, `/uploads/spareparts/%252e%252e/%252e%252e/package.json`)).status === 404, "")
    // A double slash is normalized by Next's router itself (308 to the
    // single-slash form) before middleware/route logic ever runs — not a
    // bypass, just standard URL canonicalization. Follow it and assert the
    // canonicalized request still never succeeds.
    const absPathRes = await fetch(`${BASE_URL}/uploads//etc/passwd`, { redirect: "follow" })
    record("O", "absolute-path-style segment (following normalization redirect)", absPathRes.status !== 200, `status=${absPathRes.status}`)

    await rm(path.join(UPLOADS_ROOT, "mystery-namespace"), { recursive: true, force: true })
    await rm(path.dirname(path.join(UPLOADS_ROOT, logoPath)), { recursive: true, force: true })
    await rm(path.dirname(path.join(UPLOADS_ROOT, sparePartPath)), { recursive: true, force: true })
    await rm(path.join(UPLOADS_ROOT, "quotations", "items", companyAQuotationItem.id), { recursive: true, force: true })
    await rm(path.join(UPLOADS_ROOT, "tasks", "steps", companyATaskStep.id), { recursive: true, force: true })
    await rm(path.join(UPLOADS_ROOT, "jobs", companyAJob.id), { recursive: true, force: true })
  }

  // ─── P. Stock Movements PDF category-bucket authorization (Phase 3 P0 fix) ──
  console.log("\n=== P. Stock Movements PDF category-bucket authorization ===")
  {
    // One movement per bucket in Company A, each with a unique marker string
    // in its `remark` field — lets us prove by PDF *content*, not just HTTP
    // status, that a bucket-restricted caller's export never contains a row
    // from a bucket they can't view. A coarse allow/deny check alone would
    // miss the actual exploit: the unauthorized data came back with a 200,
    // not a 403. The marker deliberately does NOT go in the part name: the
    // Stock Item cell renders `{name} ({partNumber})`, and react-pdf inserts
    // a hyphen mid-word when wrapping long unbreakable text in a narrow
    // column — corrupting a marker embedded there. `remark` is its own short,
    // isolated cell with room to spare, so the marker survives intact.
    async function makeMarkedMovement(companyId: string, category: PartCategory, marker: string, performedById: string) {
      const part = await prisma.sparePart.create({
        data: {
          companyId, partNumber: `E2E-PDF-PART-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: "E2E PDF Test Part", category, brand: "E2E", unitCost: 1, sellingPrice: 1, reorderLevel: 1,
        },
        select: { id: true },
      })
      await prisma.inventoryTransaction.create({
        data: { companyId, part: { connect: { id: part.id } }, type: "IN", quantity: 1, remark: marker, performedBy: { connect: { id: performedById } } },
      })
    }
    const EQUIP_MARKER = `E2EPDFEQ${Date.now().toString(36)}`
    const CONSUMPTION_MARKER = `E2EPDFCO${Date.now().toString(36)}`
    const PARTS_MARKER = `E2EPDFPA${Date.now().toString(36)}`
    const COMPANY_B_MARKER = `E2EPDFCB${Date.now().toString(36)}`
    await makeMarkedMovement(companyA.id, "LAPTOP_PART", EQUIP_MARKER, admin.id)
    await makeMarkedMovement(companyA.id, "TONER", CONSUMPTION_MARKER, admin.id)
    await makeMarkedMovement(companyA.id, "GENERAL", PARTS_MARKER, admin.id)
    await makeMarkedMovement(companyB.id, "GENERAL", COMPANY_B_MARKER, companyBAdmin.id)

    const equipCookieP = await login(stockEquipViewOnly.name)
    const consumptionCookieP = await login(stockConsumptionViewOnly.name)
    const partsCookieP = await login(stockPartsViewOnly.name)
    const mixedCookieP = await login(stockEquipAndConsumptionViewOnly.name)
    const zeroCookieP = await login(zeroPerm.name)
    const adminCookieP = await login(admin.name)
    const legacyCookieP = await login(legacyFullAccess.name)
    const companyBAdminCookieP = await login(companyBAdmin.name)

    // 1. No Stock permissions at all -> denied outright, regardless of category.
    const zeroResult = await getStockPdf(zeroCookieP)
    record("P", "zero-permission GET /api/stock/movements/pdf (no category)", zeroResult.status === 403, `status=${zeroResult.status}`)

    // 2. Equipment-only, category omitted -> Equipment movements only.
    const equipOmitted = await getStockPdf(equipCookieP)
    record("P", "equip-only, category omitted -> 200", equipOmitted.status === 200, `status=${equipOmitted.status}`)
    record("P", "equip-only, category omitted -> contains Equipment marker", equipOmitted.text.includes(EQUIP_MARKER), "")
    record("P", "equip-only, category omitted -> excludes Consumption marker", !equipOmitted.text.includes(CONSUMPTION_MARKER), "")
    record("P", "equip-only, category omitted -> excludes Parts marker", !equipOmitted.text.includes(PARTS_MARKER), "")

    // 3. Consumption-only, category omitted -> Consumption movements only.
    const consumptionOmitted = await getStockPdf(consumptionCookieP)
    record("P", "consumption-only, category omitted -> 200", consumptionOmitted.status === 200, `status=${consumptionOmitted.status}`)
    record("P", "consumption-only, category omitted -> contains Consumption marker", consumptionOmitted.text.includes(CONSUMPTION_MARKER), "")
    record("P", "consumption-only, category omitted -> excludes Equipment marker", !consumptionOmitted.text.includes(EQUIP_MARKER), "")
    record("P", "consumption-only, category omitted -> excludes Parts marker", !consumptionOmitted.text.includes(PARTS_MARKER), "")

    // 4. Parts-only, category omitted -> Parts movements only.
    const partsOmitted = await getStockPdf(partsCookieP)
    record("P", "parts-only, category omitted -> 200", partsOmitted.status === 200, `status=${partsOmitted.status}`)
    record("P", "parts-only, category omitted -> contains Parts marker", partsOmitted.text.includes(PARTS_MARKER), "")
    record("P", "parts-only, category omitted -> excludes Equipment marker", !partsOmitted.text.includes(EQUIP_MARKER), "")
    record("P", "parts-only, category omitted -> excludes Consumption marker", !partsOmitted.text.includes(CONSUMPTION_MARKER), "")

    // 5. Equipment + Consumption, category omitted -> both, Parts excluded.
    const mixedOmitted = await getStockPdf(mixedCookieP)
    record("P", "equip+consumption, category omitted -> 200", mixedOmitted.status === 200, `status=${mixedOmitted.status}`)
    record("P", "equip+consumption, category omitted -> contains Equipment marker", mixedOmitted.text.includes(EQUIP_MARKER), "")
    record("P", "equip+consumption, category omitted -> contains Consumption marker", mixedOmitted.text.includes(CONSUMPTION_MARKER), "")
    record("P", "equip+consumption, category omitted -> excludes Parts marker", !mixedOmitted.text.includes(PARTS_MARKER), "")

    // 6. Explicit authorized category -> allowed, scoped to that category.
    const equipExplicitAuthorized = await getStockPdf(equipCookieP, "?category=EQUIPMENT")
    record("P", "equip-only, category=EQUIPMENT (own bucket) -> 200", equipExplicitAuthorized.status === 200, `status=${equipExplicitAuthorized.status}`)
    record("P", "equip-only, category=EQUIPMENT -> contains Equipment marker", equipExplicitAuthorized.text.includes(EQUIP_MARKER), "")

    // 7. Explicit unauthorized category -> denied (403), not silently substituted.
    const equipExplicitParts = await getStockPdf(equipCookieP, "?category=PARTS")
    record("P", "equip-only, category=PARTS (unauthorized) -> 403", equipExplicitParts.status === 403, `status=${equipExplicitParts.status}`)
    const equipExplicitConsumption = await getStockPdf(equipCookieP, "?category=CONSUMPTION")
    record("P", "equip-only, category=CONSUMPTION (unauthorized) -> 403", equipExplicitConsumption.status === 403, `status=${equipExplicitConsumption.status}`)
    const consumptionExplicitParts = await getStockPdf(consumptionCookieP, "?category=PARTS")
    record("P", "consumption-only, category=PARTS (unauthorized) -> 403", consumptionExplicitParts.status === 403, `status=${consumptionExplicitParts.status}`)
    const partsExplicitEquipment = await getStockPdf(partsCookieP, "?category=EQUIPMENT")
    record("P", "parts-only, category=EQUIPMENT (unauthorized) -> 403", partsExplicitEquipment.status === 403, `status=${partsExplicitEquipment.status}`)

    // 8. Invalid/arbitrary category -> must not broaden access; fails closed rather than falling back to "all".
    const equipInvalidCategory = await getStockPdf(equipCookieP, "?category=NOT_A_REAL_CATEGORY")
    record("P", "equip-only, category=NOT_A_REAL_CATEGORY (invalid) -> 403", equipInvalidCategory.status === 403, `status=${equipInvalidCategory.status}`)
    const zeroInvalidCategory = await getStockPdf(zeroCookieP, "?category=NOT_A_REAL_CATEGORY")
    record("P", "zero-permission, category=NOT_A_REAL_CATEGORY (invalid) -> 403 (not broadened to any bucket)", zeroInvalidCategory.status === 403, `status=${zeroInvalidCategory.status}`)

    // 9. ADMIN -> legitimate full Stock access preserved, across all buckets, category omitted.
    const adminOmitted = await getStockPdf(adminCookieP)
    record("P", "admin, category omitted -> 200", adminOmitted.status === 200, `status=${adminOmitted.status}`)
    record("P", "admin, category omitted -> contains Equipment marker", adminOmitted.text.includes(EQUIP_MARKER), "")
    record("P", "admin, category omitted -> contains Consumption marker", adminOmitted.text.includes(CONSUMPTION_MARKER), "")
    record("P", "admin, category omitted -> contains Parts marker", adminOmitted.text.includes(PARTS_MARKER), "")

    // 10. Legacy/full-access non-admin (explicit ALL_PERMISSIONS backfill) -> full Stock access preserved.
    const legacyOmitted = await getStockPdf(legacyCookieP)
    record("P", "legacy-full-access, category omitted -> 200", legacyOmitted.status === 200, `status=${legacyOmitted.status}`)
    record("P", "legacy-full-access, category omitted -> contains Equipment marker", legacyOmitted.text.includes(EQUIP_MARKER), "")
    record("P", "legacy-full-access, category omitted -> contains Consumption marker", legacyOmitted.text.includes(CONSUMPTION_MARKER), "")
    record("P", "legacy-full-access, category omitted -> contains Parts marker", legacyOmitted.text.includes(PARTS_MARKER), "")

    // 11/13. companyId comes only from the session — Company A's admin export must
    // never contain Company B's marker, and vice versa, even though both are full-access admins.
    record("P", "Company A admin PDF excludes Company B marker (tenant isolation)", !adminOmitted.text.includes(COMPANY_B_MARKER), "")
    const companyBOmitted = await getStockPdf(companyBAdminCookieP)
    record("P", "Company B admin, category omitted -> 200", companyBOmitted.status === 200, `status=${companyBOmitted.status}`)
    record("P", "Company B admin PDF contains Company B marker", companyBOmitted.text.includes(COMPANY_B_MARKER), "")
    record("P", "Company B admin PDF excludes Company A markers (tenant isolation)",
      !companyBOmitted.text.includes(EQUIP_MARKER) && !companyBOmitted.text.includes(CONSUMPTION_MARKER) && !companyBOmitted.text.includes(PARTS_MARKER), "")

    // 12. A client-supplied companyId must not alter tenant scope — the route has
    // no companyId query param at all, so this proves passing one is simply ignored,
    // not that it happens to be validated away.
    const tamperedCompanyId = await getStockPdf(equipCookieP, `?companyId=${companyB.id}`)
    record("P", "equip-only, companyId query param tampering -> still 200, still own-company scope only",
      tamperedCompanyId.status === 200 && tamperedCompanyId.text.includes(EQUIP_MARKER) && !tamperedCompanyId.text.includes(COMPANY_B_MARKER), "")
  }

  // ─── Q. Legacy Jobs decommission (Final Remediation Phase 5) ────────────────
  //
  // TEST ACCOUNTING — read this before touching anything below:
  // This section previously held 39 checks proving the Jobs Engineer-assigned-
  // job ownership P1 fix (Final Remediation Phase 4): an Engineer could access/
  // mutate their own assigned job but not another engineer's, while ADMIN/
  // MANAGER stayed unrestricted, with DB- and inventory-level verification of
  // denied mutations. That fix was correct and is NOT being reverted — but
  // Phase 5 retired the entire Jobs feature those 39 checks exercised (no
  // sidebar entry, no active-module dependency — see the Legacy Jobs
  // Decommission Audit), which makes assertions like "engineer CAN access
  // their own assigned job -> 200" and "legitimate delivery deducts inventory"
  // permanently false by design: every /jobs/** page/route/action now refuses
  // unconditionally, for every role, including the owning engineer and ADMIN.
  // Those 39 checks are OBSOLETE DUE TO INTENTIONAL JOBS DECOMMISSION, not
  // deleted silently — replaced below by 30 new checks proving the decommission
  // itself: every page/API/action is unconditionally unavailable regardless of
  // auth/role/permission/ownership, the "jobs" permission is no longer
  // grantable, the two historical UI references (Stock Reports, Quotation
  // detail) show plain text instead of dead links, Stock/Quotation core
  // workflows are unaffected, and System Initialization's Jobs-table cleanup
  // code is untouched.
  console.log("\n=== Q. Legacy Jobs decommission ===")
  {
    const adminCookieQ = await login(admin.name)
    const zeroCookieQ = await login(zeroPerm.name)

    // A. Top-level Jobs pages unavailable, unconditionally — checked for both
    // ADMIN and a zero-permission caller, to prove this isn't a permission
    // gate a legacy grant could reopen.
    record("Q", "admin GET /jobs -> 404 (unconditional)", (await getPage(adminCookieQ, "/jobs")).status === 404, "")
    record("Q", "zero-permission GET /jobs -> 404 (unconditional)", (await getPage(zeroCookieQ, "/jobs")).status === 404, "")
    record("Q", "admin GET /jobs/new -> 404 (unconditional)", (await getPage(adminCookieQ, "/jobs/new")).status === 404, "")

    // B. A REAL, existing job id still 404s — this is "feature not found," not
    // "job not found," regardless of who's asking or whether the job exists.
    record("Q", "admin GET /jobs/{realJobId} -> 404 (unconditional)", (await getPage(adminCookieQ, `/jobs/${companyAJob.id}`)).status === 404, "")
    record("Q", "zero-permission GET /jobs/{realJobId} -> 404 (unconditional)", (await getPage(zeroCookieQ, `/jobs/${companyAJob.id}`)).status === 404, "")

    // C. Every Jobs sub-page unavailable too.
    record("Q", "admin GET /jobs/{id}/photos -> 404", (await getPage(adminCookieQ, `/jobs/${companyAJob.id}/photos`)).status === 404, "")
    record("Q", "admin GET /jobs/{id}/signature -> 404", (await getPage(adminCookieQ, `/jobs/${companyAJob.id}/signature`)).status === 404, "")
    record("Q", "admin GET /jobs/{id}/report -> 404", (await getPage(adminCookieQ, `/jobs/${companyAJob.id}/report`)).status === 404, "")

    // D. Every /api/jobs/** route unavailable — 404, not 401/403, and
    // regardless of authentication state, so the retired feature is never
    // advertised as a live endpoint.
    const pdfRes = await fetch(`${BASE_URL}/api/jobs/${companyAJob.id}/report/pdf`, { headers: { Cookie: adminCookieQ } })
    record("Q", "admin GET /api/jobs/{id}/report/pdf -> 404", pdfRes.status === 404, `status=${pdfRes.status}`)
    const pdfResUnauth = await fetch(`${BASE_URL}/api/jobs/${companyAJob.id}/report/pdf`)
    record("Q", "unauthenticated GET /api/jobs/{id}/report/pdf -> 404 (not 401)", pdfResUnauth.status === 404, `status=${pdfResUnauth.status}`)
    const photoPostRes = await postJobPhoto(adminCookieQ, companyAJob.id)
    record("Q", "admin POST /api/jobs/{id}/photos -> 404", photoPostRes.status === 404, `status=${photoPostRes.status}`)
    const photoDeleteRes = await fetch(`${BASE_URL}/api/jobs/${companyAJob.id}/photos/nonexistent-photo-id`, { method: "DELETE", headers: { Cookie: adminCookieQ } })
    record("Q", "admin DELETE /api/jobs/{id}/photos/{photoId} -> 404", photoDeleteRes.status === 404, `status=${photoDeleteRes.status}`)

    // E/F. Every legacy Server Action is a pure no-op — called directly (not
    // via HTTP action-id resolution: the pages that used to render the
    // components calling these no longer do, so their dev-mode manifests may
    // not even list them anymore) to prove the function bodies themselves
    // perform zero database access, regardless of caller or arguments.
    const jobCountBefore = await prisma.serviceJob.count({ where: { companyId: companyA.id } })
    const createRes = await createJob({} as JobInput)
    record("Q", "createJob() -> decommissioned", createRes.error === "This feature is no longer available.", createRes.error)
    const jobCountAfter = await prisma.serviceJob.count({ where: { companyId: companyA.id } })
    record("Q", "DB check: createJob() created ZERO new jobs", jobCountAfter === jobCountBefore, `before=${jobCountBefore} after=${jobCountAfter}`)

    const jobBefore = await prisma.serviceJob.findUnique({ where: { id: companyAJob.id } })
    const statusRes = await updateJobStatus(companyAJob.id, { toStatus: "DIAGNOSING", note: "" })
    record("Q", "updateJobStatus() -> decommissioned", statusRes.error === "This feature is no longer available.", statusRes.error)
    const assignRes = await assignEngineer(companyAJob.id, { assignedToId: admin.id })
    record("Q", "assignEngineer() -> decommissioned", assignRes.error === "This feature is no longer available.", assignRes.error)
    const notesRes = await updateTechnicianNotes(companyAJob.id, { technicianNotes: "Should never be written" })
    record("Q", "updateTechnicianNotes() -> decommissioned", notesRes.error === "This feature is no longer available.", notesRes.error)
    const signRes = await saveJobSignature(companyAJob.id, "data:image/png;base64,dGVzdA==")
    record("Q", "saveJobSignature() -> decommissioned", signRes.error === "This feature is no longer available.", signRes.error)
    const statusLogCountBefore = await prisma.jobStatusLog.count({ where: { jobId: companyAJob.id } })
    const declineRes = await declineSignature(companyAJob.id, "Should never be logged")
    record("Q", "declineSignature() -> decommissioned", declineRes.error === "This feature is no longer available.", declineRes.error)
    const reportRes = await saveRepairReport(companyAJob.id, { diagnosis: "x", workDone: "x", labourCost: 0, parts: [] })
    record("Q", "saveRepairReport() -> decommissioned (formerly the confirmed P1)", reportRes.error === "This feature is no longer available.", reportRes.error)

    const jobAfter = await prisma.serviceJob.findUnique({ where: { id: companyAJob.id } })
    record(
      "Q",
      "DB check: companyAJob completely unchanged by every action call above",
      jobAfter?.status === jobBefore?.status &&
        jobAfter?.assignedToId === jobBefore?.assignedToId &&
        jobAfter?.technicianNotes === jobBefore?.technicianNotes &&
        jobAfter?.signatureUrl === jobBefore?.signatureUrl,
      `before=${JSON.stringify(jobBefore)} after=${JSON.stringify(jobAfter)}`
    )
    const statusLogCountAfter = await prisma.jobStatusLog.count({ where: { jobId: companyAJob.id } })
    record("Q", "DB check: declineSignature() created ZERO job status log rows", statusLogCountAfter === statusLogCountBefore, `before=${statusLogCountBefore} after=${statusLogCountAfter}`)
    const reportCount = await prisma.repairReport.count({ where: { jobId: companyAJob.id } })
    record("Q", "DB check: saveRepairReport() created ZERO repair report rows", reportCount === 0, `count=${reportCount}`)

    // G. The "jobs" permission is no longer offerable through the current
    // permission tree — an admin can no longer grant it going forward.
    record("Q", "ALL_PERMISSIONS no longer includes \"jobs\"", !ALL_PERMISSIONS.includes("jobs"), `ALL_PERMISSIONS has ${ALL_PERMISSIONS.length} entries`)
    record("Q", "PERMISSION_TREE has no \"jobs\" group", !PERMISSION_TREE.some((n) => n.key === "jobs"), "")

    // H/J. Stock and Quotation — the two modules with a historical (cosmetic
    // only) reference into Jobs — remain fully functional.
    record("Q", "Stock still functional: GET /stock -> 200", (await getPage(adminCookieQ, "/stock")).status === 200, "")
    record("Q", "Stock still functional: GET /stock/movements -> 200", (await getPage(adminCookieQ, "/stock/movements")).status === 200, "")
    record("Q", "Stock still functional: GET /stock/reports -> 200", (await getPage(adminCookieQ, "/stock/reports")).status === 200, "")
    record("Q", "Quotations still functional: GET /quotations -> 200", (await getPage(adminCookieQ, "/quotations")).status === 200, "")
    record("Q", "Quotations still functional: GET /quotations/{id} -> 200", (await getPage(adminCookieQ, `/quotations/${quotationForJobLink.id}`)).status === 200, "")

    // I. Stock Reports' historical Job column: plain text, never a link into
    // the now-decommissioned /jobs/** pages.
    const stockReportsRes = await fetch(`${BASE_URL}/stock/reports?tab=movements`, { headers: { Cookie: adminCookieQ } })
    const stockReportsHtml = await stockReportsRes.text()
    record("Q", "Stock Reports shows the historical job number as text", stockReportsHtml.includes(jobForQuotationLink.jobNumber), "")
    record("Q", "Stock Reports no longer links into /jobs/**", !stockReportsHtml.includes(`href="/jobs/${jobForQuotationLink.id}`), "")

    // K. Quotation detail's historical "Converted to Job" banner: same rule.
    const quotationDetailRes = await fetch(`${BASE_URL}/quotations/${quotationForJobLink.id}`, { headers: { Cookie: adminCookieQ } })
    const quotationDetailHtml = await quotationDetailRes.text()
    record("Q", "Quotation detail shows the historical job number as text", quotationDetailHtml.includes(jobForQuotationLink.jobNumber), "")
    record("Q", "Quotation detail no longer links into /jobs/**", !quotationDetailHtml.includes(`href="/jobs/${jobForQuotationLink.id}`), "")

    // L. System Initialization's Jobs-table cleanup code is untouched —
    // verified by reading the source; System Initialization itself is never
    // executed (explicitly out of scope for this decommission).
    const deleteSource = await readFile(path.join(process.cwd(), "src", "lib", "systemInit", "delete.ts"), "utf8")
    const planSource = await readFile(path.join(process.cwd(), "src", "lib", "systemInit", "plan.ts"), "utf8")
    for (const table of ["ServiceJob", "Equipment", "MeterReading", "JobPhoto", "RepairReport", "JobPart", "JobStatusLog", "CustomerContract", "CommunicationLog"]) {
      record("Q", `systemInit/delete.ts still handles ${table}`, deleteSource.includes(`case "${table}"`), "")
      record("Q", `systemInit/plan.ts still handles ${table}`, planSource.includes(`case "${table}"`), "")
    }

    // N. The legacy Jobs protected-*upload* surface is closed too (Final
    // Remediation Phase 6) — historical job photo/signature FILES stay on
    // disk (never deleted), but become unreachable through the app for
    // every role, including ADMIN and the job's own assigned engineer, same
    // company or not, authenticated or not.
    const engineerQ = await makeUser(companyA.id, `E2E EngineerQ ${Date.now()}`, "ENGINEER", ["dashboard.view"])
    const engineerQCookie = await login(engineerQ.name)
    const companyBAdminCookieQ = await login(companyBAdmin.name)
    const legacyJobPhotoPath = `jobs/${companyAJob.id}/photos/legacy-test.jpg`
    await writeTestUploadFile(legacyJobPhotoPath)

    record("Q", "admin GET legacy job photo -> denied (file exists on disk)", (await getUpload(adminCookieQ, `/uploads/${legacyJobPhotoPath}`)).status !== 200, "")
    record("Q", "engineer GET legacy job photo -> denied", (await getUpload(engineerQCookie, `/uploads/${legacyJobPhotoPath}`)).status !== 200, "")
    record("Q", "unauthenticated GET legacy job photo -> denied (401)", (await getUpload(null, `/uploads/${legacyJobPhotoPath}`)).status === 401, "")
    record("Q", "Company B admin GET Company A's legacy job photo -> denied (cross-company, 404)", (await getUpload(companyBAdminCookieQ, `/uploads/${legacyJobPhotoPath}`)).status === 404, "")

    // Active-module protected uploads are unaffected by the jobs-namespace
    // closure — re-verify a spare-part image (a different namespace entirely)
    // still resolves normally for its legitimately-permissioned owner.
    const legacyRegressionPartPath = `spareparts/${companyASparePart.id}/regression-check.jpg`
    await writeTestUploadFile(legacyRegressionPartPath)
    record("Q", "active module (stock spare part image) unaffected: admin GET -> 200", (await getUpload(adminCookieQ, `/uploads/${legacyRegressionPartPath}`)).status === 200, "")

    await rm(path.join(UPLOADS_ROOT, "jobs", companyAJob.id), { recursive: true, force: true })
    await rm(path.join(UPLOADS_ROOT, "spareparts", companyASparePart.id), { recursive: true, force: true })
  }

  // ─── R. Ledger cross-company customerId ownership (Final Remediation Phase 7 P1 fix) ──
  console.log("\n=== R. Ledger cross-company customerId ownership ===")
  {
    const ledgerCreateEditCookie = await login(ledgerCreateEditUser.name)
    const ledgerViewOnlyCookie = await login(ledgerOnly.name)
    const companyBAdminCookieR = await login(companyBAdmin.name)

    const ledgerCategory = await prisma.ledgerCategory.create({
      data: { companyId: companyA.id, type: "INCOME", name: `E2E Ledger Category ${Date.now()}` },
      select: { id: true },
    })

    // Warm up the page's dev-mode server-reference-manifest before resolving action ids.
    await getPage(ledgerCreateEditCookie, "/ledger/income-expense")
    const createActionId = await getActionId("(dashboard)/ledger/income-expense/page", "src/lib/actions/ledger.ts", "createLedgerEntry")
    const updateActionId = await getActionId("(dashboard)/ledger/income-expense/page", "src/lib/actions/ledger.ts", "updateLedgerEntry")

    // A. Legitimate same-company create succeeds.
    const entryCountBefore = await prisma.ledgerEntry.count({ where: { companyId: companyA.id } })
    if (createActionId) {
      const res = await callAction(ledgerCreateEditCookie, "/ledger/income-expense", createActionId, [{
        type: "INCOME", categoryId: ledgerCategory.id, date: "2026-01-15", amount: 500,
        paymentMethod: "CASH", referenceNo: "", remark: "E2E same-company income", customerId: companyACustomer.id, allocations: [],
      }])
      record("R", "Company A user creates ledger entry with Company A customer -> success", /"success"\s*:\s*true/i.test(res.text), res.text.slice(0, 150))
    } else {
      record("R", "Company A user creates ledger entry with Company A customer -> success", false, "could not resolve action id")
    }
    const entryCountAfterLegit = await prisma.ledgerEntry.count({ where: { companyId: companyA.id } })
    record("R", "DB check: legitimate same-company create wrote exactly 1 row", entryCountAfterLegit === entryCountBefore + 1, `before=${entryCountBefore} after=${entryCountAfterLegit}`)

    const legitEntry = await prisma.ledgerEntry.findFirst({
      where: { companyId: companyA.id, remark: "E2E same-company income" },
      select: { id: true, customerId: true },
    })
    record("R", "legitimate entry stored with Company A's own customerId", legitEntry?.customerId === companyACustomer.id, "")

    // B/C. Cross-company create is rejected outright, with zero rows written.
    const entryCountBeforeAttack = await prisma.ledgerEntry.count({ where: { companyId: companyA.id } })
    if (createActionId) {
      const res = await callAction(ledgerCreateEditCookie, "/ledger/income-expense", createActionId, [{
        type: "INCOME", categoryId: ledgerCategory.id, date: "2026-01-15", amount: 999,
        paymentMethod: "CASH", referenceNo: "", remark: "E2E IDOR create attempt", customerId: companyBCustomer.id, allocations: [],
      }])
      record("R", "Company A user creates ledger entry with Company B customerId -> denied (\"Customer not found\")", /"error"\s*:\s*"Customer not found"/i.test(res.text), res.text.slice(0, 150))
    } else {
      record("R", "Company A user creates ledger entry with Company B customerId -> denied", false, "could not resolve action id")
    }
    const entryCountAfterAttack = await prisma.ledgerEntry.count({ where: { companyId: companyA.id } })
    record("R", "DB check: denied cross-company create wrote ZERO new rows", entryCountAfterAttack === entryCountBeforeAttack, `before=${entryCountBeforeAttack} after=${entryCountAfterAttack}`)
    const plantedEntry = await prisma.ledgerEntry.findFirst({ where: { companyId: companyA.id, remark: "E2E IDOR create attempt" } })
    record("R", "DB check: no ledger entry from the create attack exists at all", plantedEntry === null, "")

    // D. Legitimate same-company update succeeds.
    if (updateActionId && legitEntry) {
      const res = await callAction(ledgerCreateEditCookie, "/ledger/income-expense", updateActionId, [legitEntry.id, {
        type: "INCOME", categoryId: ledgerCategory.id, date: "2026-01-16", amount: 600,
        paymentMethod: "CASH", remark: "E2E same-company income (updated)", customerId: companyACustomer.id, allocations: [],
      }])
      record("R", "Company A user updates own entry with Company A customer -> success", /"success"\s*:\s*true/i.test(res.text), res.text.slice(0, 150))
    } else {
      record("R", "Company A user updates own entry with Company A customer -> success", false, "could not resolve action id or missing fixture")
    }

    // E/F. Cross-company update is rejected, and the entry is left completely unchanged.
    const beforeUpdateAttack = legitEntry ? await prisma.ledgerEntry.findUnique({ where: { id: legitEntry.id } }) : null
    if (updateActionId && legitEntry) {
      const res = await callAction(ledgerCreateEditCookie, "/ledger/income-expense", updateActionId, [legitEntry.id, {
        type: "INCOME", categoryId: ledgerCategory.id, date: "2026-01-17", amount: 777,
        paymentMethod: "CASH", remark: "E2E IDOR update attempt", customerId: companyBCustomer.id, allocations: [],
      }])
      record("R", "Company A user updates own entry to reference Company B customer -> denied (\"Customer not found\")", /"error"\s*:\s*"Customer not found"/i.test(res.text), res.text.slice(0, 150))
    } else {
      record("R", "Company A user updates own entry to reference Company B customer -> denied", false, "could not resolve action id or missing fixture")
    }
    const afterUpdateAttack = legitEntry ? await prisma.ledgerEntry.findUnique({ where: { id: legitEntry.id } }) : null
    record(
      "R",
      "DB check: denied cross-company update left the entry completely unchanged",
      JSON.stringify(beforeUpdateAttack) === JSON.stringify(afterUpdateAttack),
      `before=${JSON.stringify(beforeUpdateAttack)} after=${JSON.stringify(afterUpdateAttack)}`
    )

    // G. Ledger queries (the exact shape getLedgerEntries uses) never expose Company B
    // customer information through the joined relation.
    const companyAEntries = await prisma.ledgerEntry.findMany({
      where: { companyId: companyA.id },
      include: { customer: { select: { id: true, companyName: true } } },
    })
    record(
      "R",
      "No Company A ledger entry's joined customer is a Company B customer",
      companyAEntries.every((e) => !e.customer || e.customer.id !== companyBCustomer.id),
      ""
    )
    record(
      "R",
      "No Company A ledger entry exposes Company B customer's companyName",
      companyAEntries.every((e) => e.customer?.companyName !== companyBCustomer.companyName),
      ""
    )

    // H. Entries where the business rules never store a customerId anyway (EXPENSE type)
    // still work — the new check only ever runs for type === "INCOME" with a customerId.
    if (createActionId) {
      const res = await callAction(ledgerCreateEditCookie, "/ledger/income-expense", createActionId, [{
        type: "EXPENSE", categoryId: ledgerCategory.id, date: "2026-01-18", amount: 50,
        paymentMethod: "CASH", referenceNo: "", remark: "E2E expense no customer", customerId: "", allocations: [],
      }])
      record("R", "EXPENSE entry with no customerId still succeeds", /"success"\s*:\s*true/i.test(res.text), res.text.slice(0, 150))
    } else {
      record("R", "EXPENSE entry with no customerId still succeeds", false, "could not resolve action id")
    }

    // I. Existing permission enforcement is unchanged by this fix — a view-only user
    // (no ledger.general.create) is still Forbidden, regardless of customerId.
    if (createActionId) {
      const res = await callAction(ledgerViewOnlyCookie, "/ledger/income-expense", createActionId, [{
        type: "INCOME", categoryId: ledgerCategory.id, date: "2026-01-19", amount: 10,
        paymentMethod: "CASH", referenceNo: "", remark: "should never be created", customerId: companyACustomer.id, allocations: [],
      }])
      record("R", "ledger.general.view-only (no create permission) -> still Forbidden", wasForbidden(res), res.text.slice(0, 150))
    } else {
      record("R", "ledger.general.view-only (no create permission) -> still Forbidden", false, "could not resolve action id")
    }

    // J. Cross-company access to the LedgerEntry record itself remains denied — tenant
    // isolation is independent of, and unaffected by, the customerId ownership fix.
    if (updateActionId && legitEntry) {
      const res = await callAction(companyBAdminCookieR, "/ledger/income-expense", updateActionId, [legitEntry.id, {
        type: "INCOME", categoryId: ledgerCategory.id, date: "2026-01-20", amount: 1,
        paymentMethod: "CASH", remark: "cross-company access attempt", customerId: "", allocations: [],
      }])
      record("R", "Company B admin cannot update Company A's ledger entry -> denied (tenant isolation)", wasBlockedOrNotFound(res), res.text.slice(0, 150))
    } else {
      record("R", "Company B admin cannot update Company A's ledger entry -> denied", false, "could not resolve action id or missing fixture")
    }
  }

  // ─── S. Quotation cross-company customerId/customerBranchId ownership (Final Remediation Phase 8 P1 fix) ──
  console.log("\n=== S. Quotation cross-company customerId/customerBranchId ownership ===")
  {
    const quoteEditCookieS = await login(quotationEditOnly.name)
    const quoteViewOnlyCookieS = await login(quotationViewOnly.name)

    const companyABranch = await prisma.customerBranch.create({
      data: { companyId: companyA.id, customerId: companyACustomer.id, name: `E2E Branch A ${Date.now()}` },
      select: { id: true },
    })
    // Same company, but a DIFFERENT customer — for requirement G (branch/customer mismatch).
    const companyACustomer2 = await prisma.customer.create({
      data: { companyId: companyA.id, code: `E2EA2-${Date.now()}`, companyName: "Company A Second Customer", shortName: `CoASecond${Date.now()}` },
      select: { id: true },
    })
    const companyACustomer2Branch = await prisma.customerBranch.create({
      data: { companyId: companyA.id, customerId: companyACustomer2.id, name: `E2E Branch A2 ${Date.now()}` },
      select: { id: true },
    })
    const companyBBranch = await prisma.customerBranch.create({
      data: { companyId: companyB.id, customerId: companyBCustomer.id, name: `E2E Branch B ${Date.now()}` },
      select: { id: true },
    })

    await getPage(quoteEditCookieS, "/quotations/new")
    const createQuotationActionId = await getActionId("(dashboard)/quotations/new/page", "src/lib/actions/quotations.ts", "createQuotation")
    const updateQuotationActionId = await getActionId("(dashboard)/quotations/new/page", "src/lib/actions/quotations.ts", "updateQuotation")

    const baseItems = [{ partId: companyASparePart.id, quantity: 1, unitPrice: 1 }]

    // A/E. Legitimate same-company create, with a valid same-company/same-customer branch.
    const quoteCountBefore = await prisma.quotation.count({ where: { companyId: companyA.id } })
    // A small trailing number, not the raw ms timestamp — createQuotation() derives
    // quotationSortNumber from this via extractTrailingNumber() and stores it in a
    // plain Postgres `Int` column, which a 13-digit ms timestamp overflows.
    const quotationNumberA = `E2E-QT-CIDA-${Date.now() % 100000}`
    if (createQuotationActionId) {
      const res = await callAction(quoteEditCookieS, "/quotations/new", createQuotationActionId, [{
        quotationNumber: quotationNumberA, customerId: companyACustomer.id, customerBranchId: companyABranch.id,
        vatPercent: 16, items: baseItems,
      }])
      // createQuotation() redirect()s on success (no {success:true} JSON to check) — the
      // RSC payload for the post-redirect page always contains a literal `"error":"$undefined"`
      // LayoutRouter prop, so checking for the mere absence of the substring "error" is a false
      // positive here. redirect() itself produces a distinct 303, which a returned {error} never does.
      record("S", "Company A user creates quotation with Company A customer + branch -> success", res.status === 303, `status=${res.status} ${res.text.slice(0, 100)}`)
    } else {
      record("S", "Company A user creates quotation with Company A customer + branch -> success", false, "could not resolve action id")
    }
    const quoteCountAfterLegit = await prisma.quotation.count({ where: { companyId: companyA.id } })
    record("S", "DB check: legitimate create wrote exactly 1 quotation", quoteCountAfterLegit === quoteCountBefore + 1, `before=${quoteCountBefore} after=${quoteCountAfterLegit}`)

    const legitQuotation = await prisma.quotation.findUnique({ where: { quotationNumber: quotationNumberA } })
    record("S", "legitimate quotation stored with Company A's own customerId + branchId",
      legitQuotation?.customerId === companyACustomer.id && legitQuotation?.customerBranchId === companyABranch.id, "")

    // B/C. Cross-company customerId create is rejected, zero rows written.
    const quoteCountBeforeAttack = await prisma.quotation.count({ where: { companyId: companyA.id } })
    const quotationNumberAttack = `E2E-QT-CIDATTACK-${Date.now() % 100000}`
    if (createQuotationActionId) {
      const res = await callAction(quoteEditCookieS, "/quotations/new", createQuotationActionId, [{
        quotationNumber: quotationNumberAttack, customerId: companyBCustomer.id, customerBranchId: "",
        vatPercent: 16, items: baseItems,
      }])
      record("S", "Company A user creates quotation with Company B customerId -> denied (\"Customer not found\")", /"error"\s*:\s*"Customer not found"/i.test(res.text), res.text.slice(0, 150))
    } else {
      record("S", "Company A user creates quotation with Company B customerId -> denied", false, "could not resolve action id")
    }
    const quoteCountAfterAttack = await prisma.quotation.count({ where: { companyId: companyA.id } })
    record("S", "DB check: denied cross-company create wrote ZERO new quotations", quoteCountAfterAttack === quoteCountBeforeAttack, `before=${quoteCountBeforeAttack} after=${quoteCountAfterAttack}`)
    const plantedQuotation = await prisma.quotation.findUnique({ where: { quotationNumber: quotationNumberAttack } })
    record("S", "DB check: no quotation from the create attack exists at all", plantedQuotation === null, "")

    // D. Legitimate same-company update (change to a different Company A customer + its own branch) succeeds.
    if (updateQuotationActionId && legitQuotation) {
      const res = await callAction(quoteEditCookieS, "/quotations/new", updateQuotationActionId, [legitQuotation.id, {
        quotationNumber: quotationNumberA, customerId: companyACustomer2.id, customerBranchId: companyACustomer2Branch.id,
        vatPercent: 16, items: baseItems,
      }])
      // Same redirect()-on-success reasoning as createQuotation above.
      record("S", "Company A user updates quotation to a different Company A customer + branch -> success", res.status === 303, `status=${res.status} ${res.text.slice(0, 100)}`)
    } else {
      record("S", "Company A user updates quotation to a different Company A customer + branch -> success", false, "could not resolve action id or missing fixture")
    }

    // Cross-company update is rejected, and the quotation is left completely unchanged.
    const beforeUpdateAttack = legitQuotation ? await prisma.quotation.findUnique({ where: { id: legitQuotation.id } }) : null
    if (updateQuotationActionId && legitQuotation) {
      const res = await callAction(quoteEditCookieS, "/quotations/new", updateQuotationActionId, [legitQuotation.id, {
        quotationNumber: quotationNumberA, customerId: companyBCustomer.id, customerBranchId: "",
        vatPercent: 16, items: baseItems,
      }])
      record("S", "Company A user updates quotation to reference Company B customer -> denied (\"Customer not found\")", /"error"\s*:\s*"Customer not found"/i.test(res.text), res.text.slice(0, 150))
    } else {
      record("S", "Company A user updates quotation to reference Company B customer -> denied", false, "could not resolve action id or missing fixture")
    }
    const afterUpdateAttack = legitQuotation ? await prisma.quotation.findUnique({ where: { id: legitQuotation.id } }) : null
    record(
      "S",
      "DB check: denied cross-company update left the quotation completely unchanged",
      JSON.stringify(beforeUpdateAttack) === JSON.stringify(afterUpdateAttack),
      ""
    )

    // F. A branch belonging to another COMPANY is rejected outright, even with a valid same-company customerId.
    if (updateQuotationActionId && legitQuotation) {
      const res = await callAction(quoteEditCookieS, "/quotations/new", updateQuotationActionId, [legitQuotation.id, {
        quotationNumber: quotationNumberA, customerId: companyACustomer.id, customerBranchId: companyBBranch.id,
        vatPercent: 16, items: baseItems,
      }])
      record("S", "Cross-company branch (Company B) with valid Company A customerId -> denied (\"Customer branch not found\")", /"error"\s*:\s*"Customer branch not found"/i.test(res.text), res.text.slice(0, 150))
    } else {
      record("S", "Cross-company branch (Company B) with valid Company A customerId -> denied", false, "could not resolve action id or missing fixture")
    }

    // G. A branch belonging to a DIFFERENT customer, even inside the same company, is rejected.
    if (updateQuotationActionId && legitQuotation) {
      const res = await callAction(quoteEditCookieS, "/quotations/new", updateQuotationActionId, [legitQuotation.id, {
        quotationNumber: quotationNumberA, customerId: companyACustomer.id, customerBranchId: companyACustomer2Branch.id,
        vatPercent: 16, items: baseItems,
      }])
      record("S", "Same-company branch belonging to a different customer -> denied (\"Customer branch not found\")", /"error"\s*:\s*"Customer branch not found"/i.test(res.text), res.text.slice(0, 150))
    } else {
      record("S", "Same-company branch belonging to a different customer -> denied", false, "could not resolve action id or missing fixture")
    }

    // H. No Company A quotation — via the exact join shape the list/detail/PDF/Excel data
    // layer uses — ever exposes Company B's customer identity or contact details.
    const companyAQuotationsJoined = await prisma.quotation.findMany({
      where: { companyId: companyA.id },
      include: { customer: { select: { id: true, companyName: true, pinNumber: true, phone: true, location: true } } },
    })
    record(
      "S",
      "No Company A quotation's joined customer is Company B's customer (id)",
      companyAQuotationsJoined.every((q) => q.customer.id !== companyBCustomer.id),
      ""
    )
    // Keyed off the id match above rather than re-comparing field values directly —
    // two same-company customers can legitimately share a null pinNumber/phone, which
    // would make a naive value-equality check misfire. What actually matters is that
    // zero Company A quotations ever resolve to Company B's customer row at all —
    // if none do, none of that row's fields (companyName, pinNumber, phone, location)
    // can have been exposed through this relation, whatever their values are.
    const quotationsLeakedToCompanyB = companyAQuotationsJoined.filter((q) => q.customer.id === companyBCustomer.id)
    record(
      "S",
      "No Company A quotation exposes Company B customer's companyName/pinNumber/phone/location",
      quotationsLeakedToCompanyB.length === 0,
      `leaked=${JSON.stringify(quotationsLeakedToCompanyB.map((q) => q.customer))}`
    )

    // I. Existing item/partId validation is unaffected by this fix.
    if (createQuotationActionId) {
      const res = await callAction(quoteEditCookieS, "/quotations/new", createQuotationActionId, [{
        quotationNumber: `E2E-QT-BADPART-${Date.now() % 100000}`, customerId: companyACustomer.id, customerBranchId: "",
        vatPercent: 16, items: [{ partId: "00000000-0000-0000-0000-000000000000", quantity: 1, unitPrice: 1 }],
      }])
      record("S", "invalid partId still rejected (\"One or more stock items are invalid\")", /"error"\s*:\s*"One or more stock items are invalid"/i.test(res.text), res.text.slice(0, 150))
    } else {
      record("S", "invalid partId still rejected", false, "could not resolve action id")
    }

    // J. Existing granular permission enforcement is unchanged — quotations.view-only
    // (no quotations.create) is still Forbidden, regardless of customerId.
    if (createQuotationActionId) {
      const res = await callAction(quoteViewOnlyCookieS, "/quotations/new", createQuotationActionId, [{
        quotationNumber: `E2E-QT-NOPERM-${Date.now() % 100000}`, customerId: companyACustomer.id, customerBranchId: "",
        vatPercent: 16, items: baseItems,
      }])
      record("S", "quotations.view-only (no create permission) -> still Forbidden", wasForbidden(res), res.text.slice(0, 150))
    } else {
      record("S", "quotations.view-only (no create permission) -> still Forbidden", false, "could not resolve action id")
    }
  }

  // ─── T. Shop Account cross-company categoryId ownership (Final Remediation Phase 9 P1 fix) ──
  console.log("\n=== T. Shop Account cross-company categoryId ownership ===")
  {
    const shopEditCookieT = await login(shopAccountOnly.name)
    const shopViewOnlyCookieT = await login(shopAccountViewOnly.name)
    const companyBAdminCookieT = await login(companyBAdmin.name)

    const shopCategoryA = await prisma.shopAccountCategory.create({
      data: { companyId: companyA.id, type: "EXPENSE", name: `E2E Shop Category A ${Date.now()}` },
      select: { id: true, name: true },
    })
    const shopCategoryA2 = await prisma.shopAccountCategory.create({
      data: { companyId: companyA.id, type: "EXPENSE", name: `E2E Shop Category A2 ${Date.now()}` },
      select: { id: true, name: true },
    })
    const shopCategoryB = await prisma.shopAccountCategory.create({
      data: { companyId: companyB.id, type: "EXPENSE", name: `SECRET Shop Category B ${Date.now()}` },
      select: { id: true, name: true },
    })

    await getPage(shopEditCookieT, "/ledger/shop")
    const createShopActionId = await getActionId("(dashboard)/ledger/shop/page", "src/lib/actions/shopAccount.ts", "createShopAccountEntry")
    const updateShopActionId = await getActionId("(dashboard)/ledger/shop/page", "src/lib/actions/shopAccount.ts", "updateShopAccountEntry")

    // A. Legitimate same-company create succeeds.
    const shopEntryCountBefore = await prisma.shopAccountEntry.count({ where: { companyId: companyA.id } })
    let legitShopEntryId: string | null = null
    if (createShopActionId) {
      const res = await callAction(shopEditCookieT, "/ledger/shop", createShopActionId, [{
        date: "2026-01-15", type: "EXPENSE", categoryId: shopCategoryA.id, newCategoryName: "",
        description: "E2E same-company shop expense", payee: "", amount: 100, paymentMethod: "CASH", remarks: "",
      }])
      record("T", "Company A user creates shop entry with Company A category -> success", /"success"\s*:\s*true/i.test(res.text), res.text.slice(0, 150))
    } else {
      record("T", "Company A user creates shop entry with Company A category -> success", false, "could not resolve action id")
    }
    const shopEntryCountAfterLegit = await prisma.shopAccountEntry.count({ where: { companyId: companyA.id } })
    record("T", "DB check: legitimate create wrote exactly 1 shop entry", shopEntryCountAfterLegit === shopEntryCountBefore + 1, `before=${shopEntryCountBefore} after=${shopEntryCountAfterLegit}`)

    const legitShopEntry = await prisma.shopAccountEntry.findFirst({
      where: { companyId: companyA.id, description: "E2E same-company shop expense" },
      select: { id: true, categoryId: true },
    })
    legitShopEntryId = legitShopEntry?.id ?? null
    record("T", "legitimate shop entry stored with Company A's own categoryId", legitShopEntry?.categoryId === shopCategoryA.id, "")

    // B. Cross-company create is rejected outright, with zero rows written.
    const shopEntryCountBeforeAttack = await prisma.shopAccountEntry.count({ where: { companyId: companyA.id } })
    if (createShopActionId) {
      const res = await callAction(shopEditCookieT, "/ledger/shop", createShopActionId, [{
        date: "2026-01-15", type: "EXPENSE", categoryId: shopCategoryB.id, newCategoryName: "",
        description: "E2E IDOR shop create attempt", payee: "", amount: 999, paymentMethod: "CASH", remarks: "",
      }])
      record("T", "Company A user creates shop entry with Company B categoryId -> denied (\"Category not found\")", /"error"\s*:\s*"Category not found"/i.test(res.text), res.text.slice(0, 150))
    } else {
      record("T", "Company A user creates shop entry with Company B categoryId -> denied", false, "could not resolve action id")
    }
    const shopEntryCountAfterAttack = await prisma.shopAccountEntry.count({ where: { companyId: companyA.id } })
    record("T", "DB check: denied cross-company create wrote ZERO new shop entries", shopEntryCountAfterAttack === shopEntryCountBeforeAttack, `before=${shopEntryCountBeforeAttack} after=${shopEntryCountAfterAttack}`)
    const plantedShopEntry = await prisma.shopAccountEntry.findFirst({ where: { companyId: companyA.id, description: "E2E IDOR shop create attempt" } })
    record("T", "DB check: no shop entry from the create attack exists at all", plantedShopEntry === null, "")

    // C. Legitimate same-company update (to a different Company A category) succeeds.
    if (updateShopActionId && legitShopEntryId) {
      const res = await callAction(shopEditCookieT, "/ledger/shop", updateShopActionId, [legitShopEntryId, {
        date: "2026-01-16", type: "EXPENSE", categoryId: shopCategoryA2.id, newCategoryName: "",
        description: "E2E same-company shop expense (updated)", payee: "", amount: 150, paymentMethod: "CASH", remarks: "",
      }])
      record("T", "Company A user updates shop entry to a different Company A category -> success", /"success"\s*:\s*true/i.test(res.text), res.text.slice(0, 150))
    } else {
      record("T", "Company A user updates shop entry to a different Company A category -> success", false, "could not resolve action id or missing fixture")
    }

    // D. Cross-company update is rejected, entry left completely unchanged.
    const beforeShopUpdateAttack = legitShopEntryId ? await prisma.shopAccountEntry.findUnique({ where: { id: legitShopEntryId } }) : null
    if (updateShopActionId && legitShopEntryId) {
      const res = await callAction(shopEditCookieT, "/ledger/shop", updateShopActionId, [legitShopEntryId, {
        date: "2026-01-17", type: "EXPENSE", categoryId: shopCategoryB.id, newCategoryName: "",
        description: "E2E IDOR shop update attempt", payee: "", amount: 777, paymentMethod: "CASH", remarks: "",
      }])
      record("T", "Company A user updates shop entry to reference Company B category -> denied (\"Category not found\")", /"error"\s*:\s*"Category not found"/i.test(res.text), res.text.slice(0, 150))
    } else {
      record("T", "Company A user updates shop entry to reference Company B category -> denied", false, "could not resolve action id or missing fixture")
    }
    const afterShopUpdateAttack = legitShopEntryId ? await prisma.shopAccountEntry.findUnique({ where: { id: legitShopEntryId } }) : null
    record(
      "T",
      "DB check: denied cross-company update left the shop entry completely unchanged",
      JSON.stringify(beforeShopUpdateAttack) === JSON.stringify(afterShopUpdateAttack),
      ""
    )

    // E. The "__new__" category workflow is unaffected — it still creates/uses a category
    // belonging to the authenticated company, exactly as before this fix.
    const newCategoryName = `E2E New Shop Category ${Date.now()}`
    if (createShopActionId) {
      const res = await callAction(shopEditCookieT, "/ledger/shop", createShopActionId, [{
        date: "2026-01-18", type: "INCOME", categoryId: "__new__", newCategoryName,
        description: "E2E new-category shop income", payee: "", amount: 200, paymentMethod: "CASH", remarks: "",
      }])
      record("T", "\"__new__\" category workflow still succeeds", /"success"\s*:\s*true/i.test(res.text), res.text.slice(0, 150))
    } else {
      record("T", "\"__new__\" category workflow still succeeds", false, "could not resolve action id")
    }
    const newlyCreatedCategory = await prisma.shopAccountCategory.findFirst({ where: { companyId: companyA.id, name: newCategoryName } })
    record("T", "DB check: \"__new__\" workflow created the category under Company A (not cross-company)", newlyCreatedCategory?.companyId === companyA.id, "")
    const newIncomeEntry = await prisma.shopAccountEntry.findFirst({ where: { companyId: companyA.id, description: "E2E new-category shop income" } })
    record("T", "DB check: \"__new__\" workflow's entry references the newly-created Company A category", newIncomeEntry?.categoryId === newlyCreatedCategory?.id, "")

    // F. No Company A shop entry — via the exact join shape the list/export data layer
    // uses — ever exposes Company B's category name/type. The Excel export reads from
    // this same data, so proving the join is clean here is sufficient: it cannot format
    // into the export what the query never returns.
    const companyAShopEntriesJoined = await prisma.shopAccountEntry.findMany({
      where: { companyId: companyA.id },
      include: { category: { select: { id: true, name: true, type: true } } },
    })
    const shopEntriesLeakedToCompanyB = companyAShopEntriesJoined.filter((e) => e.category.id === shopCategoryB.id)
    record(
      "T",
      "No Company A shop entry's joined category is Company B's category (list/detail/export-safe)",
      shopEntriesLeakedToCompanyB.length === 0,
      `leaked=${JSON.stringify(shopEntriesLeakedToCompanyB.map((e) => e.category))}`
    )

    // G/H. Existing granular permission enforcement is unchanged — a view-only user (no
    // ledger.shop.create/edit) is still Forbidden for both create and update, regardless
    // of categoryId.
    if (createShopActionId) {
      const res = await callAction(shopViewOnlyCookieT, "/ledger/shop", createShopActionId, [{
        date: "2026-01-19", type: "EXPENSE", categoryId: shopCategoryA.id, newCategoryName: "",
        description: "should never be created", payee: "", amount: 10, paymentMethod: "CASH", remarks: "",
      }])
      record("T", "ledger.shop.view-only (no create permission) -> still Forbidden", wasForbidden(res), res.text.slice(0, 150))
    } else {
      record("T", "ledger.shop.view-only (no create permission) -> still Forbidden", false, "could not resolve action id")
    }
    if (updateShopActionId && legitShopEntryId) {
      const res = await callAction(shopViewOnlyCookieT, "/ledger/shop", updateShopActionId, [legitShopEntryId, {
        date: "2026-01-19", type: "EXPENSE", categoryId: shopCategoryA.id, newCategoryName: "",
        description: "should never be applied", payee: "", amount: 10, paymentMethod: "CASH", remarks: "",
      }])
      record("T", "ledger.shop.view-only (no edit permission) -> still Forbidden", wasForbidden(res), res.text.slice(0, 150))
    } else {
      record("T", "ledger.shop.view-only (no edit permission) -> still Forbidden", false, "could not resolve action id or missing fixture")
    }

    // I. Cross-company access to the ShopAccountEntry record itself remains denied —
    // tenant isolation is independent of, and unaffected by, the categoryId ownership fix.
    if (updateShopActionId && legitShopEntryId) {
      const res = await callAction(companyBAdminCookieT, "/ledger/shop", updateShopActionId, [legitShopEntryId, {
        date: "2026-01-20", type: "EXPENSE", categoryId: shopCategoryA.id, newCategoryName: "",
        description: "cross-company access attempt", payee: "", amount: 1, paymentMethod: "CASH", remarks: "",
      }])
      record("T", "Company B admin cannot update Company A's shop entry -> denied (tenant isolation)", wasBlockedOrNotFound(res), res.text.slice(0, 150))
    } else {
      record("T", "Company B admin cannot update Company A's shop entry -> denied", false, "could not resolve action id or missing fixture")
    }
  }

  // ─── U. Invoice cross-company customerId ownership on update (Final Remediation Phase 10 P1 fix) ──
  console.log("\n=== U. Invoice cross-company customerId ownership on update ===")
  {
    const invoiceEditCookieU = await login(invoiceCreateEditUser.name)
    const invoiceViewOnlyCookieU = await login(invoiceViewOnly.name)
    const companyBAdminCookieU = await login(companyBAdmin.name)

    // A second Company A customer, distinct from companyACustomer, so the legitimate
    // update in (A) is a real change, not a no-op re-save of the same value.
    const companyACustomer2ForInvoice = await prisma.customer.create({
      data: { companyId: companyA.id, code: `E2EA-INV2-${Date.now()}`, companyName: "Company A Second Invoice Customer", shortName: `CoAInv2${Date.now()}` },
      select: { id: true },
    })

    await getPage(invoiceEditCookieU, "/quotations/invoices/new")
    const createDirectInvoiceActionId = await getActionId("(dashboard)/quotations/invoices/new/page", "src/lib/actions/invoices.ts", "createDirectInvoice")
    const updateInvoiceActionId = await getActionId("(dashboard)/quotations/invoices/new/page", "src/lib/actions/invoices.ts", "updateInvoice")

    const invoiceItems = [{ partId: companyASparePart.id, quantity: 1, unitPrice: 1 }]

    // E. createDirectInvoice remains safe and functional (already-validated create path,
    // unmodified by this fix) — also serves as setup for the update-path tests below.
    const invoiceCountBefore = await prisma.invoice.count({ where: { companyId: companyA.id } })
    const invoiceNumberU = `E2E-INV-CIDU-${Date.now() % 100000}`
    if (createDirectInvoiceActionId) {
      const res = await callAction(invoiceEditCookieU, "/quotations/invoices/new", createDirectInvoiceActionId, [{
        invoiceNumber: invoiceNumberU, customerId: companyACustomer.id, customerPin: "", date: "2026-01-15",
        vatPercent: 16, remarks: "", items: invoiceItems,
      }])
      record("U", "createDirectInvoice: Company A user creates invoice with Company A customer -> success", res.status === 303, `status=${res.status}`)
    } else {
      record("U", "createDirectInvoice: Company A user creates invoice with Company A customer -> success", false, "could not resolve action id")
    }
    const invoiceCountAfterCreate = await prisma.invoice.count({ where: { companyId: companyA.id } })
    record("U", "DB check: createDirectInvoice wrote exactly 1 invoice", invoiceCountAfterCreate === invoiceCountBefore + 1, `before=${invoiceCountBefore} after=${invoiceCountAfterCreate}`)

    // E (continued). createDirectInvoice's own pre-existing customer ownership check is
    // unaffected by this fix — cross-company create is still denied, zero rows written.
    const invoiceCountBeforeCreateAttack = await prisma.invoice.count({ where: { companyId: companyA.id } })
    if (createDirectInvoiceActionId) {
      const res = await callAction(invoiceEditCookieU, "/quotations/invoices/new", createDirectInvoiceActionId, [{
        invoiceNumber: `E2E-INV-CREATEATTACK-${Date.now() % 100000}`, customerId: companyBCustomer.id, customerPin: "", date: "2026-01-15",
        vatPercent: 16, remarks: "", items: invoiceItems,
      }])
      record("U", "createDirectInvoice: cross-company customerId still denied (regression)", /"error"\s*:\s*"Customer not found"/i.test(res.text), res.text.slice(0, 150))
    } else {
      record("U", "createDirectInvoice: cross-company customerId still denied (regression)", false, "could not resolve action id")
    }
    const invoiceCountAfterCreateAttack = await prisma.invoice.count({ where: { companyId: companyA.id } })
    record("U", "DB check: createDirectInvoice cross-company attempt wrote ZERO rows", invoiceCountAfterCreateAttack === invoiceCountBeforeCreateAttack, "")
    // generateInvoice never accepts a client-supplied customerId at all — it derives the
    // customer from an already companyId-validated Quotation — so there is structurally
    // nothing for this fix to have regressed there; not exercised further in this section.

    const legitInvoice = await prisma.invoice.findUnique({ where: { invoiceNumber: invoiceNumberU } })

    // A. Legitimate same-company update (to a different Company A customer) succeeds,
    // with the correct customerId stored.
    if (updateInvoiceActionId && legitInvoice) {
      const res = await callAction(invoiceEditCookieU, "/quotations/invoices/new", updateInvoiceActionId, [legitInvoice.id, {
        invoiceNumber: invoiceNumberU, customerId: companyACustomer2ForInvoice.id, customerPin: "", date: "2026-01-16",
        vatPercent: 16, remarks: "", items: invoiceItems,
      }])
      record("U", "updateInvoice: Company A user updates to a different Company A customer -> success", res.status === 303, `status=${res.status}`)
    } else {
      record("U", "updateInvoice: Company A user updates to a different Company A customer -> success", false, "could not resolve action id or missing fixture")
    }
    const afterLegitUpdate = legitInvoice ? await prisma.invoice.findUnique({ where: { id: legitInvoice.id } }) : null
    record("U", "DB check: legitimate update stored the new Company A customerId", afterLegitUpdate?.customerId === companyACustomer2ForInvoice.id, "")

    // B/C. Cross-company customerId update is rejected, and the invoice is left
    // completely unchanged (full snapshot comparison, not just the customerId field).
    const beforeCrossCompanyUpdate = legitInvoice ? await prisma.invoice.findUnique({ where: { id: legitInvoice.id } }) : null
    if (updateInvoiceActionId && legitInvoice) {
      const res = await callAction(invoiceEditCookieU, "/quotations/invoices/new", updateInvoiceActionId, [legitInvoice.id, {
        invoiceNumber: invoiceNumberU, customerId: companyBCustomer.id, customerPin: "", date: "2026-01-17",
        vatPercent: 16, remarks: "E2E IDOR update attempt", items: invoiceItems,
      }])
      record("U", "updateInvoice: Company A user updates to reference Company B customer -> denied (\"Customer not found\")", /"error"\s*:\s*"Customer not found"/i.test(res.text), res.text.slice(0, 150))
    } else {
      record("U", "updateInvoice: Company A user updates to reference Company B customer -> denied", false, "could not resolve action id or missing fixture")
    }
    const afterCrossCompanyUpdate = legitInvoice ? await prisma.invoice.findUnique({ where: { id: legitInvoice.id } }) : null
    record(
      "U",
      "DB check: denied cross-company update left the invoice completely unchanged (customerId + every other field)",
      JSON.stringify(beforeCrossCompanyUpdate) === JSON.stringify(afterCrossCompanyUpdate),
      ""
    )

    // D. No Company A invoice — via the exact join shape the list/detail/getInvoiceForPdf/
    // PDF/Excel data layer uses — ever resolves its customer relation to Company B.
    const companyAInvoicesJoined = await prisma.invoice.findMany({
      where: { companyId: companyA.id },
      include: { customer: { select: { id: true, companyName: true, name: true, pinNumber: true } } },
    })
    const invoicesLeakedToCompanyB = companyAInvoicesJoined.filter((inv) => inv.customer.id === companyBCustomer.id)
    record(
      "U",
      "No Company A invoice's joined customer is Company B's customer (list/detail/PDF/Excel-safe)",
      invoicesLeakedToCompanyB.length === 0,
      `leaked=${JSON.stringify(invoicesLeakedToCompanyB.map((inv) => inv.customer))}`
    )

    // F. Existing items[].partId ownership validation on updateInvoice is unchanged.
    if (updateInvoiceActionId && legitInvoice) {
      const res = await callAction(invoiceEditCookieU, "/quotations/invoices/new", updateInvoiceActionId, [legitInvoice.id, {
        invoiceNumber: invoiceNumberU, customerId: companyACustomer2ForInvoice.id, customerPin: "", date: "2026-01-18",
        vatPercent: 16, remarks: "", items: [{ partId: "00000000-0000-0000-0000-000000000000", quantity: 1, unitPrice: 1 }],
      }])
      record("U", "updateInvoice: invalid partId still rejected (\"One or more stock items are invalid\")", /"error"\s*:\s*"One or more stock items are invalid"/i.test(res.text), res.text.slice(0, 150))
    } else {
      record("U", "updateInvoice: invalid partId still rejected", false, "could not resolve action id or missing fixture")
    }

    // G. Existing granular permission enforcement is unchanged — invoice.view-only (no
    // invoice.edit) is still Forbidden, regardless of customerId.
    if (updateInvoiceActionId && legitInvoice) {
      const res = await callAction(invoiceViewOnlyCookieU, "/quotations/invoices/new", updateInvoiceActionId, [legitInvoice.id, {
        invoiceNumber: invoiceNumberU, customerId: companyACustomer.id, customerPin: "", date: "2026-01-19",
        vatPercent: 16, remarks: "", items: invoiceItems,
      }])
      record("U", "invoice.view-only (no edit permission) -> still Forbidden", wasForbidden(res), res.text.slice(0, 150))
    } else {
      record("U", "invoice.view-only (no edit permission) -> still Forbidden", false, "could not resolve action id or missing fixture")
    }

    // H. Cross-company access to the Invoice record itself remains denied — tenant
    // isolation is independent of, and unaffected by, the customerId ownership fix.
    if (updateInvoiceActionId && legitInvoice) {
      const res = await callAction(companyBAdminCookieU, "/quotations/invoices/new", updateInvoiceActionId, [legitInvoice.id, {
        invoiceNumber: invoiceNumberU, customerId: companyACustomer.id, customerPin: "", date: "2026-01-20",
        vatPercent: 16, remarks: "cross-company access attempt", items: invoiceItems,
      }])
      record("U", "Company B admin cannot update Company A's invoice -> denied (tenant isolation)", wasBlockedOrNotFound(res), res.text.slice(0, 150))
    } else {
      record("U", "Company B admin cannot update Company A's invoice -> denied", false, "could not resolve action id or missing fixture")
    }
  }

  // ─── V. Tasks cross-company participantId ownership on create (Final Remediation Phase 11 P1 fix) ──
  console.log("\n=== V. Tasks cross-company participantId ownership on create ===")
  {
    const taskCreatorCookie = await login(taskCreatorUser.name)
    const taskParticipantCookieV = await login(taskParticipant.name)

    const inactiveCompanyAUser = await prisma.user.create({
      data: {
        companyId: companyA.id, name: `E2E InactiveUser ${Date.now()}`, passwordHash: "x",
        role: "RECEPTIONIST", modulePermissions: [], isActive: false,
      },
      select: { id: true },
    })

    await getPage(taskCreatorCookie, "/tasks")
    const createTaskActionId = await getActionId("(dashboard)/tasks/page", "src/lib/actions/tasks.ts", "createTask")
    const addTaskParticipantsActionId = await getActionId("(dashboard)/tasks/page", "src/lib/actions/tasks.ts", "addTaskParticipants")

    // A. Legitimate same-company create with an active participant succeeds.
    const taskCountBefore = await prisma.task.count({ where: { companyId: companyA.id } })
    const taskTitleA = `E2E task same-company ${Date.now()}`
    if (createTaskActionId) {
      const res = await callAction(taskCreatorCookie, "/tasks", createTaskActionId, [{
        title: taskTitleA, initialStepTitle: "Step 1", initialStepDescription: "",
        participantIds: [taskParticipant.id],
      }])
      record("V", "createTask: same-company active participant -> success", /"success"\s*:\s*true/i.test(res.text), res.text.slice(0, 150))
    } else {
      record("V", "createTask: same-company active participant -> success", false, "could not resolve action id")
    }
    const taskCountAfterLegit = await prisma.task.count({ where: { companyId: companyA.id } })
    record("V", "DB check: legitimate create wrote exactly 1 task", taskCountAfterLegit === taskCountBefore + 1, `before=${taskCountBefore} after=${taskCountAfterLegit}`)
    const legitTask = await prisma.task.findFirst({ where: { companyId: companyA.id, title: taskTitleA }, include: { participants: true } })
    record("V", "legitimate task has exactly 1 participant, the one requested", legitTask?.participants.length === 1 && legitTask.participants[0].userId === taskParticipant.id, "")

    // B/C. Cross-company participant is rejected outright, with zero rows written.
    const taskCountBeforeAttack = await prisma.task.count({ where: { companyId: companyA.id } })
    const taskTitleAttack = `E2E task IDOR attempt ${Date.now()}`
    if (createTaskActionId) {
      const res = await callAction(taskCreatorCookie, "/tasks", createTaskActionId, [{
        title: taskTitleAttack, initialStepTitle: "Step 1", initialStepDescription: "",
        participantIds: [companyBAdmin.id],
      }])
      record("V", "createTask: Company B participantId -> denied (\"One or more selected participants are invalid\")", /"error"\s*:\s*"One or more selected participants are invalid"/i.test(res.text), res.text.slice(0, 150))
    } else {
      record("V", "createTask: Company B participantId -> denied", false, "could not resolve action id")
    }
    const taskCountAfterAttack = await prisma.task.count({ where: { companyId: companyA.id } })
    record("V", "DB check: denied cross-company create wrote ZERO new tasks", taskCountAfterAttack === taskCountBeforeAttack, `before=${taskCountBeforeAttack} after=${taskCountAfterAttack}`)
    const plantedTask = await prisma.task.findFirst({ where: { companyId: companyA.id, title: taskTitleAttack } })
    record("V", "DB check: no task from the create attack exists at all", plantedTask === null, "")
    const plantedParticipant = await prisma.taskParticipant.findFirst({ where: { userId: companyBAdmin.id, task: { companyId: companyA.id } } })
    record("V", "DB check: ZERO TaskParticipant rows link Company B's admin into Company A", plantedParticipant === null, "")

    // D. Nonexistent/malformed participant id gets the same generic rejection.
    if (createTaskActionId) {
      const res = await callAction(taskCreatorCookie, "/tasks", createTaskActionId, [{
        title: `E2E task bad id ${Date.now()}`, initialStepTitle: "Step 1", initialStepDescription: "",
        participantIds: ["00000000-0000-0000-0000-000000000000"],
      }])
      record("V", "createTask: nonexistent participant id -> denied (same generic message)", /"error"\s*:\s*"One or more selected participants are invalid"/i.test(res.text), res.text.slice(0, 150))
    } else {
      record("V", "createTask: nonexistent participant id -> denied", false, "could not resolve action id")
    }

    // E. Inactive same-company user is rejected too (matches addTaskParticipants' rule).
    if (createTaskActionId) {
      const res = await callAction(taskCreatorCookie, "/tasks", createTaskActionId, [{
        title: `E2E task inactive user ${Date.now()}`, initialStepTitle: "Step 1", initialStepDescription: "",
        participantIds: [inactiveCompanyAUser.id],
      }])
      record("V", "createTask: inactive same-company user -> denied", /"error"\s*:\s*"One or more selected participants are invalid"/i.test(res.text), res.text.slice(0, 150))
    } else {
      record("V", "createTask: inactive same-company user -> denied", false, "could not resolve action id")
    }

    // F. Duplicate legitimate participant ids are deduped safely — success, exactly 1
    // TaskParticipant row, not 2, and not a false rejection.
    const taskTitleDup = `E2E task duplicate ids ${Date.now()}`
    if (createTaskActionId) {
      const res = await callAction(taskCreatorCookie, "/tasks", createTaskActionId, [{
        title: taskTitleDup, initialStepTitle: "Step 1", initialStepDescription: "",
        participantIds: [taskParticipant.id, taskParticipant.id],
      }])
      record("V", "createTask: duplicate same-company participant ids -> success", /"success"\s*:\s*true/i.test(res.text), res.text.slice(0, 150))
    } else {
      record("V", "createTask: duplicate same-company participant ids -> success", false, "could not resolve action id")
    }
    const dupTask = await prisma.task.findFirst({ where: { companyId: companyA.id, title: taskTitleDup }, include: { participants: true } })
    record("V", "DB check: duplicate ids produced exactly 1 TaskParticipant row (not 2)", dupTask?.participants.length === 1, `count=${dupTask?.participants.length}`)

    // G. Mixed list (1 valid Company A + 1 Company B) is rejected atomically — the
    // entire create fails, not just the bad entry silently dropped.
    const taskCountBeforeMixed = await prisma.task.count({ where: { companyId: companyA.id } })
    const taskTitleMixed = `E2E task mixed list ${Date.now()}`
    if (createTaskActionId) {
      const res = await callAction(taskCreatorCookie, "/tasks", createTaskActionId, [{
        title: taskTitleMixed, initialStepTitle: "Step 1", initialStepDescription: "",
        participantIds: [taskParticipant.id, companyBAdmin.id],
      }])
      record("V", "createTask: mixed Company A + Company B participant list -> denied atomically", /"error"\s*:\s*"One or more selected participants are invalid"/i.test(res.text), res.text.slice(0, 150))
    } else {
      record("V", "createTask: mixed Company A + Company B participant list -> denied atomically", false, "could not resolve action id")
    }
    const taskCountAfterMixed = await prisma.task.count({ where: { companyId: companyA.id } })
    record("V", "DB check: mixed-list denial wrote ZERO new tasks (no partial creation)", taskCountAfterMixed === taskCountBeforeMixed, "")

    // H/I. addTaskParticipants() (adding to an EXISTING task) is unmodified by this fix —
    // its own pre-existing ownership check still works both ways.
    if (addTaskParticipantsActionId && legitTask) {
      const res = await callAction(taskCreatorCookie, "/tasks", addTaskParticipantsActionId, [legitTask.id, { userIds: [taskCreatorUser.id] }])
      record("V", "addTaskParticipants: legitimate same-company add -> success (regression)", /"success"\s*:\s*true/i.test(res.text), res.text.slice(0, 150))
    } else {
      record("V", "addTaskParticipants: legitimate same-company add -> success (regression)", false, "could not resolve action id or missing fixture")
    }
    if (addTaskParticipantsActionId && legitTask) {
      const res = await callAction(taskCreatorCookie, "/tasks", addTaskParticipantsActionId, [legitTask.id, { userIds: [companyBAdmin.id] }])
      record("V", "addTaskParticipants: cross-company add -> still denied (regression)", /"error"\s*:\s*"One or more selected users are invalid"/i.test(res.text), res.text.slice(0, 150))
    } else {
      record("V", "addTaskParticipants: cross-company add -> still denied (regression)", false, "could not resolve action id or missing fixture")
    }

    // J. Existing permission enforcement is unchanged — a user without task-creation
    // authority is still Forbidden, regardless of participantIds.
    if (createTaskActionId) {
      const res = await callAction(taskParticipantCookieV, "/tasks", createTaskActionId, [{
        title: "should never be created", initialStepTitle: "Step 1", initialStepDescription: "",
        participantIds: [taskParticipant.id],
      }])
      record("V", "createTask: no creation authority -> still Forbidden", wasForbidden(res), res.text.slice(0, 150))
    } else {
      record("V", "createTask: no creation authority -> still Forbidden", false, "could not resolve action id")
    }

    // K. Re-run the exact TasksView.tsx relation shape — no Company A task ever
    // resolves a participant belonging to Company B.
    const companyATasksJoined = await prisma.task.findMany({
      where: { companyId: companyA.id },
      include: { participants: { include: { user: { select: { id: true, name: true, companyId: true } } } } },
    })
    const tasksLeakedToCompanyB = companyATasksJoined.flatMap((t) => t.participants).filter((p) => p.user.companyId === companyB.id)
    record(
      "V",
      "No Company A task's participants resolve to a Company B user (Tasks UI-safe)",
      tasksLeakedToCompanyB.length === 0,
      `leaked=${JSON.stringify(tasksLeakedToCompanyB.map((p) => p.user))}`
    )
  }

  // ─── W. Sales Ledger cross-company customerId ownership (Final Remediation Phase 12 P2 fix) ──
  console.log("\n=== W. Sales Ledger cross-company customerId ownership ===")
  {
    const salesLedgerCookieW = await login(salesLedgerCreateEditUser.name)
    const ledgerViewOnlyCookieW = await login(ledgerOnly.name)
    const companyBAdminCookieW = await login(companyBAdmin.name)

    const companyACustomer2ForSalesLedger = await prisma.customer.create({
      data: { companyId: companyA.id, code: `E2EA-SL2-${Date.now()}`, companyName: "Company A Second Sales Ledger Customer", shortName: `CoASL2${Date.now()}` },
      select: { id: true },
    })

    await getPage(salesLedgerCookieW, "/ledger/sales")
    const createSalesLedgerActionId = await getActionId("(dashboard)/ledger/sales/page", "src/lib/actions/ledger.ts", "createSalesLedgerEntry")
    const updateSalesLedgerActionId = await getActionId("(dashboard)/ledger/sales/page", "src/lib/actions/ledger.ts", "updateSalesLedgerEntry")

    // A. Legitimate same-company create succeeds.
    const salesEntryCountBefore = await prisma.salesLedgerEntry.count({ where: { companyId: companyA.id } })
    const remarkA = `E2E same-company sales entry ${Date.now()}`
    if (createSalesLedgerActionId) {
      const res = await callAction(salesLedgerCookieW, "/ledger/sales", createSalesLedgerActionId, [{
        date: "2026-01-15", customerId: companyACustomer.id, customerName: "Company A Customer Snapshot",
        orderNo: "", invoiceAmount: 500, amountReceived: 0, remark: remarkA,
      }])
      record("W", "createSalesLedgerEntry: same-company customerId -> success", /"success"\s*:\s*true/i.test(res.text), res.text.slice(0, 150))
    } else {
      record("W", "createSalesLedgerEntry: same-company customerId -> success", false, "could not resolve action id")
    }
    const salesEntryCountAfterLegit = await prisma.salesLedgerEntry.count({ where: { companyId: companyA.id } })
    record("W", "DB check: legitimate create wrote exactly 1 sales ledger entry", salesEntryCountAfterLegit === salesEntryCountBefore + 1, `before=${salesEntryCountBefore} after=${salesEntryCountAfterLegit}`)

    const legitSalesEntry = await prisma.salesLedgerEntry.findFirst({ where: { companyId: companyA.id, remark: remarkA } })
    record("W", "legitimate entry stored with Company A's own customerId", legitSalesEntry?.customerId === companyACustomer.id, "")
    // H. customerName snapshot behavior is untouched by this fix — it's stored verbatim,
    // independent of (and not derived from) the validated customerId.
    record("W", "customerName snapshot stored exactly as submitted (unchanged behavior)", legitSalesEntry?.customerName === "Company A Customer Snapshot", "")

    // B/C. Cross-company create is rejected outright, with zero rows written.
    const salesEntryCountBeforeAttack = await prisma.salesLedgerEntry.count({ where: { companyId: companyA.id } })
    const remarkAttack = `E2E IDOR sales create attempt ${Date.now()}`
    if (createSalesLedgerActionId) {
      const res = await callAction(salesLedgerCookieW, "/ledger/sales", createSalesLedgerActionId, [{
        date: "2026-01-15", customerId: companyBCustomer.id, customerName: "Attacker-supplied name",
        orderNo: "", invoiceAmount: 999, amountReceived: 0, remark: remarkAttack,
      }])
      record("W", "createSalesLedgerEntry: Company B customerId -> denied (\"Customer not found\")", /"error"\s*:\s*"Customer not found"/i.test(res.text), res.text.slice(0, 150))
    } else {
      record("W", "createSalesLedgerEntry: Company B customerId -> denied", false, "could not resolve action id")
    }
    const salesEntryCountAfterAttack = await prisma.salesLedgerEntry.count({ where: { companyId: companyA.id } })
    record("W", "DB check: denied cross-company create wrote ZERO new sales ledger entries", salesEntryCountAfterAttack === salesEntryCountBeforeAttack, `before=${salesEntryCountBeforeAttack} after=${salesEntryCountAfterAttack}`)
    const plantedSalesEntry = await prisma.salesLedgerEntry.findFirst({ where: { companyId: companyA.id, remark: remarkAttack } })
    record("W", "DB check: no sales ledger entry from the create attack exists at all", plantedSalesEntry === null, "")

    // D. Legitimate same-company update (to a different Company A customer) succeeds.
    if (updateSalesLedgerActionId && legitSalesEntry) {
      const res = await callAction(salesLedgerCookieW, "/ledger/sales", updateSalesLedgerActionId, [legitSalesEntry.id, {
        date: "2026-01-16", customerId: companyACustomer2ForSalesLedger.id, customerName: "Company A Customer 2 Snapshot",
        orderNo: "", invoiceAmount: 600, amountReceived: 0, remark: `${remarkA} (updated)`,
      }])
      record("W", "updateSalesLedgerEntry: to a different Company A customerId -> success", /"success"\s*:\s*true/i.test(res.text), res.text.slice(0, 150))
    } else {
      record("W", "updateSalesLedgerEntry: to a different Company A customerId -> success", false, "could not resolve action id or missing fixture")
    }
    const afterLegitUpdate = legitSalesEntry ? await prisma.salesLedgerEntry.findUnique({ where: { id: legitSalesEntry.id } }) : null
    record("W", "DB check: legitimate update stored the new Company A customerId", afterLegitUpdate?.customerId === companyACustomer2ForSalesLedger.id, "")
    record("W", "DB check: customerName snapshot updated to the newly-submitted value", afterLegitUpdate?.customerName === "Company A Customer 2 Snapshot", "")

    // E/F. Cross-company update is rejected, and the entry is left completely unchanged.
    const beforeCrossCompanyUpdate = legitSalesEntry ? await prisma.salesLedgerEntry.findUnique({ where: { id: legitSalesEntry.id } }) : null
    if (updateSalesLedgerActionId && legitSalesEntry) {
      const res = await callAction(salesLedgerCookieW, "/ledger/sales", updateSalesLedgerActionId, [legitSalesEntry.id, {
        date: "2026-01-17", customerId: companyBCustomer.id, customerName: "Attacker-supplied name 2",
        orderNo: "", invoiceAmount: 777, amountReceived: 0, remark: "E2E IDOR update attempt",
      }])
      record("W", "updateSalesLedgerEntry: to reference Company B customerId -> denied (\"Customer not found\")", /"error"\s*:\s*"Customer not found"/i.test(res.text), res.text.slice(0, 150))
    } else {
      record("W", "updateSalesLedgerEntry: to reference Company B customerId -> denied", false, "could not resolve action id or missing fixture")
    }
    const afterCrossCompanyUpdate = legitSalesEntry ? await prisma.salesLedgerEntry.findUnique({ where: { id: legitSalesEntry.id } }) : null
    record(
      "W",
      "DB check: denied cross-company update left the sales ledger entry completely unchanged",
      JSON.stringify(beforeCrossCompanyUpdate) === JSON.stringify(afterCrossCompanyUpdate),
      ""
    )

    // G. The pre-existing null/optional customerId workflow (a pure manual/legacy entry)
    // is untouched — the new check only ever runs when customerId is truthy.
    const remarkNoCustomer = `E2E manual entry no customerId ${Date.now()}`
    if (createSalesLedgerActionId) {
      const res = await callAction(salesLedgerCookieW, "/ledger/sales", createSalesLedgerActionId, [{
        date: "2026-01-18", customerId: "", customerName: "Walk-in Customer",
        orderNo: "", invoiceAmount: 100, amountReceived: 0, remark: remarkNoCustomer,
      }])
      record("W", "createSalesLedgerEntry: null/empty customerId still succeeds (unchanged behavior)", /"success"\s*:\s*true/i.test(res.text), res.text.slice(0, 150))
    } else {
      record("W", "createSalesLedgerEntry: null/empty customerId still succeeds", false, "could not resolve action id")
    }
    const noCustomerEntry = await prisma.salesLedgerEntry.findFirst({ where: { companyId: companyA.id, remark: remarkNoCustomer } })
    record("W", "DB check: entry with no customerId stores customerId = null", noCustomerEntry?.customerId === null, `customerId=${noCustomerEntry?.customerId}`)

    // I. Sales Ledger list/detail pages are unaffected — no customer relation join was
    // introduced; both still render normally.
    record("W", "Sales Ledger list still functional: GET /ledger/sales -> 200", (await getPage(salesLedgerCookieW, "/ledger/sales")).status === 200, "")
    if (legitSalesEntry) {
      record("W", "Sales Ledger detail still functional: GET /ledger/sales/{id} -> 200", (await getPage(salesLedgerCookieW, `/ledger/sales/${legitSalesEntry.id}`)).status === 200, "")
    }

    // J. Excel export still works.
    const exportRes = await fetch(`${BASE_URL}/api/ledger/sales/export`, { headers: { Cookie: salesLedgerCookieW } })
    record(
      "W",
      "Sales Ledger Excel export still works",
      exportRes.status === 200 && (exportRes.headers.get("content-type") ?? "").includes("spreadsheetml"),
      `status=${exportRes.status} content-type=${exportRes.headers.get("content-type")}`
    )

    // K. Existing granular permission enforcement is unchanged — view-only (no
    // ledger.sales.create) is still Forbidden, regardless of customerId.
    if (createSalesLedgerActionId) {
      const res = await callAction(ledgerViewOnlyCookieW, "/ledger/sales", createSalesLedgerActionId, [{
        date: "2026-01-19", customerId: companyACustomer.id, customerName: "should never be created",
        orderNo: "", invoiceAmount: 10, amountReceived: 0, remark: "",
      }])
      record("W", "ledger.sales.view-only (no create permission) -> still Forbidden", wasForbidden(res), res.text.slice(0, 150))
    } else {
      record("W", "ledger.sales.view-only (no create permission) -> still Forbidden", false, "could not resolve action id")
    }

    // L. Cross-company access to the SalesLedgerEntry record itself remains denied —
    // tenant isolation is independent of, and unaffected by, the customerId fix.
    if (updateSalesLedgerActionId && legitSalesEntry) {
      const res = await callAction(companyBAdminCookieW, "/ledger/sales", updateSalesLedgerActionId, [legitSalesEntry.id, {
        date: "2026-01-20", customerId: "", customerName: "cross-company access attempt",
        orderNo: "", invoiceAmount: 1, amountReceived: 0, remark: "",
      }])
      record("W", "Company B admin cannot update Company A's sales ledger entry -> denied (tenant isolation)", wasBlockedOrNotFound(res), res.text.slice(0, 150))
    } else {
      record("W", "Company B admin cannot update Company A's sales ledger entry -> denied", false, "could not resolve action id or missing fixture")
    }
  }

  // ─── Regression: Admin ──────────────────────────────────────────────────────
  console.log("\n=== Regression: Admin (full access) ===")
  {
    const cookie = await login(admin.name)
    for (const path of [
      "/customers", "/stock", "/quotations", "/quotations/invoices", "/ledger", "/ledger/sales",
      "/ledger/shop", "/ledger/income-expense", "/tasks", "/users", "/settings", "/settings/audit-log",
    ]) {
      const r = await getPage(cookie, path)
      record("Admin", `admin GET ${path}`, r.status === 200, `status=${r.status}`)
    }

    // Admin must retain Approve/Reject (fail-closed change must not over-block ADMIN).
    const approveActionId = await getActionId("(dashboard)/quotations/[id]/page", "src/lib/actions/quotations.ts", "updateQuotationStatus")
    const adminApprovable = await prisma.quotation.create({
      data: { quotationNumber: `E2E-QT-ADMIN-${Date.now()}`, companyId: companyA.id, customerId: companyACustomer.id, createdById: admin.id, status: "SENT" },
      select: { id: true },
    })
    if (approveActionId) {
      const res = await callAction(cookie, `/quotations/${adminApprovable.id}`, approveActionId, [adminApprovable.id, { toStatus: "APPROVED", note: "" }])
      const nowApproved = await prisma.quotation.findUnique({ where: { id: adminApprovable.id }, select: { status: true } })
      record("Admin", "admin updateQuotationStatus(-> APPROVED)", nowApproved?.status === "APPROVED", `status=${nowApproved?.status}, resp=${res.text.slice(0, 150)}`)
    } else {
      record("Admin", "admin updateQuotationStatus(-> APPROVED)", false, "could not resolve action id")
    }
  }

  // ─── Summary ─────────────────────────────────────────────────────────────────
  const failed = results.filter((r) => !r.pass)
  console.log(`\n=== E2E Summary ===`)
  console.log(`Total checks: ${results.length}`)
  console.log(`Passed:       ${results.length - failed.length}`)
  console.log(`Failed:       ${failed.length}`)
  if (failed.length > 0) {
    console.log(`\nFailed checks:`)
    for (const f of failed) console.log(`  [${f.area}] ${f.description} — ${f.detail}`)
  }

  if (!KEEP) {
    const companyIds = [companyA.id, companyB.id]
    // Viewing a ledger/shop/stock page can lazily seed default categories or
    // audit rows as a side effect — clean those up too, or the final Company
    // delete fails on a leftover FK reference.
    await prisma.auditLog.deleteMany({ where: { companyId: { in: companyIds } } })
    await prisma.shopAccountEntry.deleteMany({ where: { companyId: { in: companyIds } } })
    await prisma.shopAccountCategory.deleteMany({ where: { companyId: { in: companyIds } } })
    await prisma.ledgerEntry.deleteMany({ where: { companyId: { in: companyIds } } })
    await prisma.ledgerCategory.deleteMany({ where: { companyId: { in: companyIds } } })
    await prisma.salesLedgerEntry.deleteMany({ where: { companyId: { in: companyIds } } })
    await prisma.taskParticipant.deleteMany({ where: { task: { companyId: { in: companyIds } } } })
    await prisma.taskStep.deleteMany({ where: { task: { companyId: { in: companyIds } } } })
    await prisma.task.deleteMany({ where: { companyId: { in: companyIds } } })
    await prisma.invoiceItem.deleteMany({ where: { invoice: { companyId: { in: companyIds } } } })
    await prisma.invoice.deleteMany({ where: { companyId: { in: companyIds } } })
    await prisma.quotationItem.deleteMany({ where: { quotation: { companyId: { in: companyIds } } } })
    // Section S's createQuotation()/updateQuotation() calls are the first fixtures in this
    // suite to go through the real action (rather than a raw prisma.quotation.create for
    // fixture setup), which best-effort snapshots a QuotationVersion row — clean it up first
    // or the quotation delete below fails on the FK reference.
    await prisma.quotationVersion.deleteMany({ where: { companyId: { in: companyIds } } })
    await prisma.quotation.deleteMany({ where: { companyId: { in: companyIds } } })
    await prisma.inventoryTransaction.deleteMany({ where: { companyId: { in: companyIds } } })
    await prisma.inventoryStock.deleteMany({ where: { part: { companyId: { in: companyIds } } } })
    await prisma.sparePart.deleteMany({ where: { companyId: { in: companyIds } } })
    // Company-scoped (not fixture-id-scoped) so this stays correct regardless
    // of which fixtures in this suite happen to touch these tables — mirrors
    // the same relation-scoping systemInit/delete.ts uses for the same tables.
    await prisma.jobPart.deleteMany({ where: { report: { job: { companyId: { in: companyIds } } } } })
    await prisma.repairReport.deleteMany({ where: { job: { companyId: { in: companyIds } } } })
    await prisma.jobPhoto.deleteMany({ where: { job: { companyId: { in: companyIds } } } })
    await prisma.jobStatusLog.deleteMany({ where: { job: { companyId: { in: companyIds } } } })
    await prisma.serviceJob.deleteMany({ where: { companyId: { in: companyIds } } })
    await prisma.equipment.deleteMany({ where: { companyId: { in: companyIds } } })
    await prisma.customerBranch.deleteMany({ where: { companyId: { in: companyIds } } })
    await prisma.customer.deleteMany({ where: { companyId: { in: companyIds } } })
    await prisma.user.deleteMany({ where: { companyId: { in: companyIds } } })
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } })
    console.log(`\nCleaned up test companies ${companyA.id} and ${companyB.id}.`)
  } else {
    console.log(`\n--keep passed: test companies ${companyA.id} (A) / ${companyB.id} (B) left in place.`)
  }

  await prisma.$disconnect()
  process.exit(failed.length > 0 ? 1 : 0)
}

/** Resolve a Server Action's build-time reference id from Next's dev server-reference-manifest for the given page route. */
async function getActionId(pageRoute: string, sourceFile: string, exportedName: string): Promise<string | null> {
  const fs = await import("node:fs/promises")
  const path = await import("node:path")
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

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads")

/** Writes a tiny real file directly under public/uploads at the given relative path — the same tree src/app/uploads/[...path]/route.ts serves from — so ALLOW-case tests hit a real 200, not a false negative from a merely-missing file. */
async function writeTestUploadFile(relativePath: string): Promise<void> {
  const filePath = path.join(UPLOADS_ROOT, relativePath)
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, Buffer.from("E2E test file"))
}

/** GET a raw path under /uploads with an arbitrary cookie (or none) — used for the upload-authorization test matrix. */
async function getUpload(cookie: string | null, uploadPath: string): Promise<{ status: number }> {
  const res = await fetch(`${BASE_URL}${uploadPath}`, {
    headers: cookie ? { Cookie: cookie } : {},
    redirect: "manual",
  })
  return { status: res.status }
}

/**
 * Extracts all readable text from a PDF buffer produced by @react-pdf/renderer.
 * Its content streams are FlateDecode-compressed, and text runs are emitted as
 * hex-encoded TJ string tokens (e.g. `<50726f6265> Tj`) even for the non-embedded
 * Helvetica/Helvetica-Bold base fonts this app uses — never a plain `(...)Tj`
 * literal. Inflating each stream and decoding those hex tokens is what lets the
 * Stock Movements PDF test below prove a bucket-restricted export never contains
 * a row from a bucket the caller can't view, by content rather than by trusting
 * the HTTP status code alone (the original exploit returned a 200, not a 403).
 */
function extractPdfText(buf: Buffer): string {
  const raw = buf.toString("latin1")
  let idx = 0
  let text = ""
  while (true) {
    const streamKeywordAt = raw.indexOf("stream", idx)
    if (streamKeywordAt === -1) break
    const afterKeyword = streamKeywordAt + 6
    const streamStart = raw[afterKeyword] === "\r" ? afterKeyword + 2 : afterKeyword + 1
    const streamEnd = raw.indexOf("endstream", streamStart)
    if (streamEnd === -1) break
    try {
      const inflated = zlib.inflateSync(buf.subarray(streamStart, streamEnd))
      const hexTokens = inflated.toString("latin1").match(/<([0-9A-Fa-f]+)>/g) ?? []
      text += hexTokens.map((t) => Buffer.from(t.slice(1, -1), "hex").toString("latin1")).join("")
    } catch {
      // Not a compressed text stream (e.g. an embedded image) — irrelevant here.
    }
    idx = streamEnd + 9
  }
  return text
}

/** POSTs a genuine (sharp-generated, 1x1 red pixel) JPEG to the job photo upload endpoint — the route pipes the upload through `sharp()` itself, so an arbitrary text buffer would fail before authorization is even relevant. */
async function postJobPhoto(cookie: string, jobId: string): Promise<{ status: number; text: string }> {
  const buffer = await sharp({ create: { width: 1, height: 1, channels: 3, background: { r: 255, g: 0, b: 0 } } }).jpeg().toBuffer()
  const formData = new FormData()
  formData.append("file", new Blob([new Uint8Array(buffer)], { type: "image/jpeg" }), "test.jpg")
  formData.append("photoType", "BEFORE")
  const res = await fetch(`${BASE_URL}/api/jobs/${jobId}/photos`, { method: "POST", headers: { Cookie: cookie }, body: formData })
  return { status: res.status, text: await res.text() }
}

/** GET the Stock Movements PDF export with an arbitrary cookie and query string, returning its decoded text (empty if the request was denied). */
async function getStockPdf(cookie: string | null, query = ""): Promise<{ status: number; text: string }> {
  const res = await fetch(`${BASE_URL}/api/stock/movements/pdf${query}`, {
    headers: cookie ? { Cookie: cookie } : {},
    redirect: "manual",
  })
  if (res.status !== 200) return { status: res.status, text: "" }
  const buf = Buffer.from(await res.arrayBuffer())
  return { status: res.status, text: extractPdfText(buf) }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

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

  async function makeUser(companyId: string, name: string, role: "ADMIN" | "MANAGER" | "RECEPTIONIST", permissions: string[]) {
    return prisma.user.create({
      data: { companyId, name, passwordHash, role, modulePermissions: permissions, isActive: true },
      select: { id: true, name: true },
    })
  }

  const admin = await makeUser(companyA.id, `E2E Admin ${Date.now()}`, "ADMIN", [])
  const zeroPerm = await makeUser(companyA.id, `E2E ZeroPerm ${Date.now()}`, "RECEPTIONIST", [])
  const customerViewOnly = await makeUser(companyA.id, `E2E CustView ${Date.now()}`, "RECEPTIONIST", ["dashboard.view", "customers.view"])
  const stockEquipViewOnly = await makeUser(companyA.id, `E2E StockEquip ${Date.now()}`, "RECEPTIONIST", ["dashboard.view", "stock.equipment.view"])
  const quotationViewOnly = await makeUser(companyA.id, `E2E QuoteView ${Date.now()}`, "RECEPTIONIST", ["dashboard.view", "quotations.view"])
  const shopAccountOnly = await makeUser(companyA.id, `E2E ShopOnly ${Date.now()}`, "RECEPTIONIST", ["dashboard.view", "ledger.shop.view", "ledger.shop.create", "ledger.shop.edit"])
  const ledgerOnly = await makeUser(companyA.id, `E2E LedgerOnly ${Date.now()}`, "RECEPTIONIST", ["dashboard.view", "ledger.general.view", "ledger.sales.view"])
  const managerNoUserPerm = await makeUser(companyA.id, `E2E MgrNoUserPerm ${Date.now()}`, "MANAGER", ["dashboard.view", "users.view"])

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

  console.log(`Created test company ${companyA.id} (A) and ${companyB.id} (B) with ${8} + ${1} users.\n`)

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
  }

  // ─── Regression: Admin ──────────────────────────────────────────────────────
  console.log("\n=== Regression: Admin (full access) ===")
  {
    const cookie = await login(admin.name)
    for (const path of ["/customers", "/stock", "/quotations", "/quotations/invoices", "/ledger", "/ledger/sales", "/ledger/shop", "/tasks", "/users", "/settings"]) {
      const r = await getPage(cookie, path)
      record("Admin", `admin GET ${path}`, r.status === 200, `status=${r.status}`)
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
    await prisma.quotationItem.deleteMany({ where: { quotation: { companyId: { in: companyIds } } } })
    await prisma.quotation.deleteMany({ where: { companyId: { in: companyIds } } })
    await prisma.inventoryTransaction.deleteMany({ where: { companyId: { in: companyIds } } })
    await prisma.inventoryStock.deleteMany({ where: { part: { companyId: { in: companyIds } } } })
    await prisma.sparePart.deleteMany({ where: { companyId: { in: companyIds } } })
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

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

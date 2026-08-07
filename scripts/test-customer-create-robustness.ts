/**
 * Regression coverage for the Customer.code collision fix in
 * src/lib/actions/customers.ts (createCustomer / updateCustomer).
 *
 * Exercises the real HTTP + Server Action path against a running dev server
 * (real NextAuth session cookies, real Prisma transactions) — same technique
 * as scripts/e2e-permission-security-test.ts. Creates its own disposable
 * companies/users/customers and deletes them all on exit.
 *
 * Prerequisite: `npm run dev` must already be running on BASE_URL.
 * Run with: npx tsx scripts/test-customer-create-robustness.ts
 */
import "dotenv/config"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"
import bcrypt from "bcryptjs"
import fs from "node:fs/promises"
import path from "node:path"

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

/**
 * The RSC action response is a multi-line stream, one `<rowId>:<payload>` frame
 * per line — on a real page it includes the entire re-rendered component tree
 * (hundreds of frames), not just our result. The action's own return value is
 * the one frame whose payload is a bare `{"success":...}` or `{"error":...}`
 * object, so find that line specifically rather than grabbing "the last `{...}`
 * in the whole text" (which just matches whatever unrelated frame happens to be
 * last).
 */
function parseActionResult(text: string): Record<string, unknown> {
  const match = text.match(/^\d+:(\{"(?:success|error)":.*\})$/m)
  if (!match) throw new Error(`Could not parse action response: ${text.slice(0, 500)}`)
  return JSON.parse(match[1])
}

const CODE_RE = /^CUST-\d{4}$/

async function main() {
  console.log(`Target: ${BASE_URL}\n`)
  const passwordHash = await bcrypt.hash(PASSWORD, 10)

  // ─── Baseline snapshot: existing customers must be untouched by this run (M) ───
  const baselineCustomers = await prisma.customer.findMany({ select: { id: true, code: true, companyName: true } })

  const companyA = await prisma.company.create({
    data: { name: "Robustness Test Co A", code: `RCT-A-${Date.now()}`, currency: "KES", timezone: "Africa/Nairobi" },
  })
  const companyB = await prisma.company.create({
    data: { name: "Robustness Test Co B", code: `RCT-B-${Date.now()}`, currency: "KES", timezone: "Africa/Nairobi" },
  })
  const adminA = await prisma.user.create({
    data: { companyId: companyA.id, name: `RCT Admin A ${Date.now()}`, passwordHash, role: "ADMIN", modulePermissions: [], isActive: true },
  })
  const adminB = await prisma.user.create({
    data: { companyId: companyB.id, name: `RCT Admin B ${Date.now()}`, passwordHash, role: "ADMIN", modulePermissions: [], isActive: true },
  })
  const viewOnlyA = await prisma.user.create({
    data: {
      companyId: companyA.id,
      name: `RCT ViewOnly A ${Date.now()}`,
      passwordHash,
      role: "RECEPTIONIST",
      modulePermissions: ["dashboard.view", "customers.view"],
      isActive: true,
    },
  })

  const createActionId = await getActionId("(dashboard)/customers/new/page", "src/lib/actions/customers.ts", "createCustomer")
  if (!createActionId) {
    console.error("Could not resolve createCustomer's action id from .next/dev manifest.")
    console.error("Make sure `npm run dev` is running and you have visited /customers/new at least once so Next.js has compiled that route, then retry.")
    process.exit(1)
  }

  try {
    // ─── A/B. Normal creation succeeds; code stays in CUST-XXXX format ─────────
    console.log("\n=== A/B. Normal creation ===")
    {
      const cookie = await login(adminA.name)
      const res = await callAction(cookie, "/customers/new", createActionId, [
        { companyName: "Normal Co", shortName: `NORM-${Date.now()}`, projects: [] },
      ])
      const body = parseActionResult(res.text) as { success?: boolean; id?: string; error?: string }
      record("A", "Normal customer creation succeeds", body.success === true && !!body.id, JSON.stringify(body))
      if (body.id) {
        const row = await prisma.customer.findUnique({ where: { id: body.id }, select: { code: true } })
        record("B", "Generated code matches CUST-XXXX format", !!row && CODE_RE.test(row.code), `code=${row?.code}`)
      }
    }

    // ─── C. Duplicate Short Name still rejected with the friendly message ──────
    console.log("\n=== C. Duplicate Short Name (unchanged) ===")
    {
      const cookie = await login(adminA.name)
      const shortName = `DUPTEST-${Date.now()}`
      const first = await callAction(cookie, "/customers/new", createActionId, [
        { companyName: "Dup Test Co", shortName, projects: [] },
      ])
      const firstBody = parseActionResult(first.text) as { success?: boolean; id?: string }
      record("C", "First create with a fresh Short Name succeeds", firstBody.success === true, JSON.stringify(firstBody))

      const before = await prisma.customer.count({ where: { companyId: companyA.id } })
      const second = await callAction(cookie, "/customers/new", createActionId, [
        { companyName: "Dup Test Co 2", shortName: shortName.toLowerCase(), projects: [] },
      ])
      const after = await prisma.customer.count({ where: { companyId: companyA.id } })
      const secondBody = parseActionResult(second.text) as { error?: string }
      record(
        "C",
        "Case-insensitive duplicate Short Name rejected with friendly message (single attempt, not retried)",
        secondBody.error === `Short Name "${shortName.toLowerCase()}" is already used by another customer`,
        JSON.stringify(secondBody)
      )
      record("C", "Rejected duplicate did not create a row", before === after, `before=${before} after=${after}`)
    }

    // ─── D/E. Concurrent creates for the SAME company can't fail merely from a ──
    // ─── shared initial code candidate — retry must produce a genuinely new one ─
    console.log("\n=== D/E. Concurrent create race (same company) ===")
    {
      const cookieX = await login(adminA.name)
      const cookieY = await login(adminA.name)
      const tag = Date.now()
      const [resX, resY] = await Promise.all([
        callAction(cookieX, "/customers/new", createActionId, [
          { companyName: "Race Co X", shortName: `RACEX-${tag}`, projects: [] },
        ]),
        callAction(cookieY, "/customers/new", createActionId, [
          { companyName: "Race Co Y", shortName: `RACEY-${tag}`, projects: [] },
        ]),
      ])
      const bodyX = parseActionResult(resX.text) as { success?: boolean; id?: string; error?: string }
      const bodyY = parseActionResult(resY.text) as { success?: boolean; id?: string; error?: string }
      record("D", "Concurrent create #1 succeeds", bodyX.success === true, JSON.stringify(bodyX))
      record("D", "Concurrent create #2 succeeds (this is the fix under test)", bodyY.success === true, JSON.stringify(bodyY))
      if (bodyX.id && bodyY.id) {
        const [rowX, rowY] = await Promise.all([
          prisma.customer.findUnique({ where: { id: bodyX.id }, select: { code: true } }),
          prisma.customer.findUnique({ where: { id: bodyY.id }, select: { code: true } }),
        ])
        record("E", "Both concurrent creates ended up with distinct, valid codes", !!rowX && !!rowY && rowX.code !== rowY.code && CODE_RE.test(rowX.code) && CODE_RE.test(rowY.code), `X=${rowX?.code} Y=${rowY?.code}`)
      }
    }

    // ─── F. Bounded retry: force every attempt to collide, confirm it gives up ──
    // ─── cleanly (no infinite loop, no partial rows, friendly message) ─────────
    console.log("\n=== F. Retry is bounded (all 3 attempts forced to collide) ===")
    {
      // During the real call, attempts 0 and 1 fail and ROLL BACK — they leave no
      // trace — so only rows that exist *before* the real call starts affect its
      // candidates. That means real attempt 0 always sees company-scoped count C,
      // and real attempts 1/2 always see the same final global count G (the count
      // once all our blockers are in place), regardless of how many attempts came
      // before. So the three candidates are C+1, G+2, G+3 — but G itself equals
      // (today's global count) + (however many of those 3 codes we end up
      // inserting as new blockers), which is what we solve for below: try each
      // small candidate blocker-count until it's self-consistent, then insert
      // exactly that resolved set once. (A naive one-insert-at-a-time simulation
      // doesn't converge here: blocking today's real "attempt 2" candidate always
      // pushes the *next* recomputed candidate one further, forever.)
      const companyCount = await prisma.customer.count({ where: { companyId: companyA.id } })
      const baseGlobalCount = await prisma.customer.count()
      const target1 = `CUST-${String(companyCount + 1).padStart(4, "0")}`

      let blockCodes: string[] = []
      for (let guessN = 0; guessN <= 3; guessN++) {
        const target2 = `CUST-${String(baseGlobalCount + guessN + 2).padStart(4, "0")}`
        const target3 = `CUST-${String(baseGlobalCount + guessN + 3).padStart(4, "0")}`
        const candidates = [...new Set([target1, target2, target3])]
        const existing = new Set(
          (await prisma.customer.findMany({ where: { code: { in: candidates } }, select: { code: true } })).map((c) => c.code)
        )
        const needed = candidates.filter((c) => !existing.has(c))
        if (needed.length === guessN) {
          blockCodes = needed
          break
        }
      }
      for (const code of blockCodes) {
        await prisma.customer.create({
          data: { companyId: companyB.id, code, companyName: `Blocker ${code}`, shortName: `BLOCK-${code}-${Date.now()}` },
        })
      }

      const branchCountBefore = await prisma.customerBranch.count()
      const custCountBefore = await prisma.customer.count()

      const cookie = await login(adminA.name)
      const res = await callAction(cookie, "/customers/new", createActionId, [
        {
          companyName: "Forced Collision Co",
          shortName: `FORCED-${Date.now()}`,
          projects: [{ name: "Should never be persisted" }],
        },
      ])
      const body = parseActionResult(res.text) as { error?: string; success?: boolean }
      const custCountAfter = await prisma.customer.count()
      const branchCountAfter = await prisma.customerBranch.count()

      record("F", "Exhausting all retries returns the generic friendly error (not raw Prisma text)", body.error === "Failed to create customer", JSON.stringify(body))
      record("F", "No new Customer row leaked despite 3 failed attempts", custCountAfter === custCountBefore, `before=${custCountBefore} after=${custCountAfter}`)
      record("L", "No orphan CustomerBranch row leaked from the failed attempts", branchCountAfter === branchCountBefore, `before=${branchCountBefore} after=${branchCountAfter}`)

      // Remove the blocker rows now, not just at final cleanup — leaving them in
      // place would keep occupying whatever codes the *next* test section's real
      // (bounded, 3-attempt) sequence needs next, causing unrelated false failures.
      await prisma.customer.deleteMany({ where: { code: { in: blockCodes } } })
    }

    // ─── H. Customer + CustomerBranch creation stays atomic on success ─────────
    console.log("\n=== H. Customer + CustomerBranch atomicity ===")
    {
      const cookie = await login(adminA.name)
      const res = await callAction(cookie, "/customers/new", createActionId, [
        {
          companyName: "With Branch Co",
          shortName: `BRANCH-${Date.now()}`,
          projects: [{ name: "HQ Branch", contactPerson: "Jane" }],
        },
      ])
      const body = parseActionResult(res.text) as { success?: boolean; id?: string }
      record("H", "Create with a project succeeds", body.success === true, JSON.stringify(body))
      if (body.id) {
        const branches = await prisma.customerBranch.findMany({ where: { customerId: body.id } })
        record("H", "Exactly one CustomerBranch row was created alongside the customer", branches.length === 1 && branches[0].name === "HQ Branch", `count=${branches.length}`)
      }
    }

    // ─── I. Company isolation: same Short Name in two different companies ──────
    console.log("\n=== I. Company isolation ===")
    {
      const sharedShortName = `SHARED-${Date.now()}`
      const cookieA = await login(adminA.name)
      const cookieB = await login(adminB.name)
      const resA = await callAction(cookieA, "/customers/new", createActionId, [
        { companyName: "Company A's Customer", shortName: sharedShortName, projects: [] },
      ])
      const resB = await callAction(cookieB, "/customers/new", createActionId, [
        { companyName: "Company B's Customer", shortName: sharedShortName, projects: [] },
      ])
      const bodyA = parseActionResult(resA.text) as { success?: boolean; id?: string }
      const bodyB = parseActionResult(resB.text) as { success?: boolean; id?: string }
      record("I", "Same Short Name is allowed across two different companies (isolation preserved)", bodyA.success === true && bodyB.success === true, `A=${JSON.stringify(bodyA)} B=${JSON.stringify(bodyB)}`)
      if (bodyA.id && bodyB.id) {
        const [rowA, rowB] = await Promise.all([
          prisma.customer.findUnique({ where: { id: bodyA.id } }),
          prisma.customer.findUnique({ where: { id: bodyB.id } }),
        ])
        record("I", "Each customer row carries its own company's companyId", rowA?.companyId === companyA.id && rowB?.companyId === companyB.id, `A.companyId=${rowA?.companyId} B.companyId=${rowB?.companyId}`)
      }
    }

    // ─── J. Existing permission check still enforced (customers.view != .create) ─
    console.log("\n=== J. Permission enforcement unchanged ===")
    {
      const cookie = await login(viewOnlyA.name)
      const res = await callAction(cookie, "/customers/new", createActionId, [
        { companyName: "Should Be Forbidden Co", shortName: `FORBIDDEN-${Date.now()}`, projects: [] },
      ])
      const body = parseActionResult(res.text) as { error?: string }
      record("J", "customers.view-only user is still denied customer creation", body.error === "Forbidden", JSON.stringify(body))
    }
  } finally {
    // ─── Cleanup ────────────────────────────────────────────────────────────
    // Scoped by companyId rather than the cleanupCustomerIds tracking list —
    // catches every row this run created (including e.g. Section F's "blocker"
    // rows) regardless of whether any individual test section tracked its id.
    const testCompanyIds = [companyA.id, companyB.id]
    const testUserIds = [adminA.id, adminB.id, viewOnlyA.id]
    await prisma.auditLog.deleteMany({ where: { performedById: { in: testUserIds } } })
    await prisma.customerBranch.deleteMany({ where: { companyId: { in: testCompanyIds } } })
    await prisma.customer.deleteMany({ where: { companyId: { in: testCompanyIds } } })
    await prisma.user.deleteMany({ where: { id: { in: testUserIds } } })
    await prisma.company.deleteMany({ where: { id: { in: testCompanyIds } } })

    // ─── M. Existing customer records/codes are unchanged by this run ─────────
    const finalCustomers = await prisma.customer.findMany({ select: { id: true, code: true, companyName: true } })
    const baselineSet = new Set(baselineCustomers.map((c) => `${c.id}:${c.code}:${c.companyName}`))
    const finalSet = new Set(finalCustomers.map((c) => `${c.id}:${c.code}:${c.companyName}`))
    const untouched = baselineSet.size === finalSet.size && [...baselineSet].every((s) => finalSet.has(s))
    record("M", "Pre-existing customer records/codes are byte-for-byte unchanged", untouched, `before=${baselineCustomers.length} after=${finalCustomers.length}`)
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

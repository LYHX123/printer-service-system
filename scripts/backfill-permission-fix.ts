/**
 * One-time backfill for the Final Remediation Phase 1 (Permission & Security
 * Hardening) change to src/lib/permissions.ts: hasPermission/hasAnyPermission
 * no longer treat an empty User.modulePermissions array as "full access" for
 * non-ADMIN roles (that back-compat behavior was itself P0-1 — a "zero
 * permission" user silently got the entire app). This script preserves the
 * *current* effective access of every EXISTING (pre-deploy) account across
 * that change:
 *
 *   1. Non-ADMIN users with an EMPTY modulePermissions array get it set to
 *      the full ALL_PERMISSIONS list — before this change they had implicit
 *      full access, so this keeps them at exactly the access they had.
 *   2. Non-ADMIN users who already hold "quotations.edit" (the closest
 *      existing signal of real, deliberately-granted quotation-management
 *      authority) get the new "quotations.approve" leaf added, since
 *      Approve/Reject previously had NO permission check at all (P0-7) —
 *      anyone who could even just view a quotation could approve/reject it.
 *      This does NOT extend to quotations.view-only holders — restoring
 *      approve to every viewer would defeat the exact gap P0-7 closes, and
 *      the audit spec explicitly calls that out as unacceptable. Everyone
 *      else does not get it: least-privilege by default.
 *
 * ── Rule 1 (empty array) is only safe for users that predate this code's
 * deploy — an empty array created AFTER deploy is not a legacy artifact,
 * it's an administrator deliberately unchecking every box for a new
 * zero-permission user, and must NOT be turned into full access. Since
 * `modulePermissions = []` looks identical in both cases, this script
 * disambiguates by creation time:
 *
 *   --before <ISO datetime>   Only apply Rule 1 to users created strictly
 *                             before this timestamp (pass the exact code
 *                             deploy time). Users created at/after it are
 *                             reported as SKIPPED, never touched by Rule 1.
 *                             Strongly recommended for any run against a
 *                             database where the new code may already be
 *                             live, or where new users may have been
 *                             created after this migration was written.
 *
 *   (omitted)                 Rule 1 applies to every empty-array user with
 *                             no time bound — only safe when you can
 *                             guarantee every current empty-array row
 *                             predates the semantic change (e.g. running
 *                             this against a fresh/dev database, or as part
 *                             of a deploy pipeline step that runs strictly
 *                             BEFORE the new code goes live, so no
 *                             post-change zero-permission user could exist
 *                             yet). The script prints a loud warning and
 *                             requires --i-understand-unbounded to proceed
 *                             without --before, so this is never accidental.
 *
 * Rule 2 (quotations.approve for quotations.edit holders) is NOT time-bound —
 * quotations.edit is always an explicit, deliberately-granted permission
 * regardless of when the user was created, so it's safe to (re)apply anytime.
 *
 * Safety: only ever appends to modulePermissions; never touches isActive,
 * role, companyId, passwordHash, or any other field. Idempotent — rerunning
 * is a no-op once every row already reflects the rules above.
 *
 * Usage:
 *   npx tsx scripts/backfill-permission-fix.ts --dry-run [--before <ISO>]
 *   npx tsx scripts/backfill-permission-fix.ts --before <ISO>
 *   npx tsx scripts/backfill-permission-fix.ts --i-understand-unbounded
 */
import "dotenv/config"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"
import { ALL_PERMISSIONS } from "../src/lib/permissions"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const DRY_RUN = process.argv.includes("--dry-run")
const UNBOUNDED_OK = process.argv.includes("--i-understand-unbounded")
const beforeArgIndex = process.argv.indexOf("--before")
const beforeArg = beforeArgIndex !== -1 ? process.argv[beforeArgIndex + 1] : undefined

function parseCutover(): Date | null {
  if (!beforeArg) return null
  const d = new Date(beforeArg)
  if (Number.isNaN(d.getTime())) {
    console.error(`Invalid --before value: "${beforeArg}" — expected an ISO datetime, e.g. 2026-08-06T00:00:00Z`)
    process.exit(1)
  }
  return d
}

async function main() {
  const cutover = parseCutover()

  if (!cutover && !DRY_RUN && !UNBOUNDED_OK) {
    console.error(
      [
        "Refusing to write without a safety bound.",
        "Rule 1 (empty modulePermissions -> ALL_PERMISSIONS) cannot tell a legacy",
        "pre-deploy user apart from a genuine new zero-permission user by looking",
        "at the array alone — both are just `[]`.",
        "",
        "Pass one of:",
        "  --before <ISO datetime>       only backfill users created before this time",
        "                                 (use the exact code deploy timestamp)",
        "  --i-understand-unbounded       apply Rule 1 to every empty-array user with",
        "                                 no time bound — only correct if you can",
        "                                 guarantee no post-deploy zero-permission user",
        "                                 exists yet (e.g. running strictly before the",
        "                                 new code goes live)",
        "  --dry-run                      report only, no writes, no flag required",
      ].join("\n")
    )
    process.exit(1)
  }

  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE (will write)"}`)
  console.log(`Rule 1 cutover: ${cutover ? cutover.toISOString() : UNBOUNDED_OK ? "none (--i-understand-unbounded)" : "n/a (dry-run, no bound given)"}`)
  console.log(`Database: ${maskConnectionString(process.env.DATABASE_URL ?? "")}\n`)

  const users = await prisma.user.findMany({
    where: { role: { not: "ADMIN" } },
    select: { id: true, name: true, companyId: true, role: true, modulePermissions: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })

  let emptyBackfilled = 0
  let emptySkippedAfterCutover = 0
  let approveGranted = 0
  let untouched = 0

  for (const user of users) {
    let next: string[] | null = null
    let reason = ""

    if (user.modulePermissions.length === 0) {
      const eligible = cutover ? user.createdAt < cutover : true
      if (eligible) {
        next = [...ALL_PERMISSIONS]
        reason = "empty modulePermissions, predates cutover -> restore to full (legacy back-compat)"
      } else {
        emptySkippedAfterCutover++
        console.log(
          `  [SKIP - created after cutover, presumed intentional zero-permission] ${user.name} (${user.role}, company ${user.companyId}, createdAt=${user.createdAt.toISOString()})`
        )
        continue
      }
    } else if (
      user.modulePermissions.includes("quotations.edit") &&
      !user.modulePermissions.includes("quotations.approve")
    ) {
      next = [...user.modulePermissions, "quotations.approve"]
      reason = "holds quotations.edit -> grant new quotations.approve leaf"
    }

    if (next) {
      const before = user.modulePermissions.length === 0 ? "[]" : `[${user.modulePermissions.length} perms]`
      const after = `[${next.length} perms]`
      console.log(`  [${DRY_RUN ? "WOULD UPDATE" : "UPDATED"}] ${user.name} (id=${user.id}, ${user.role}, company ${user.companyId})`)
      console.log(`      reason: ${reason}`)
      console.log(`      before: ${before}  after: ${after}`)
      if (!DRY_RUN) {
        await prisma.user.update({ where: { id: user.id }, data: { modulePermissions: next } })
      }
      if (user.modulePermissions.length === 0) emptyBackfilled++
      else approveGranted++
    } else {
      untouched++
    }
  }

  console.log(`\n=== Summary (${DRY_RUN ? "DRY RUN — nothing written" : "LIVE — written"}) ===`)
  console.log(`Non-ADMIN users checked:                 ${users.length}`)
  console.log(`Empty array -> backfilled to full:       ${emptyBackfilled}`)
  console.log(`Empty array skipped (after cutover):     ${emptySkippedAfterCutover}`)
  console.log(`quotations.edit holders granted approve: ${approveGranted}`)
  console.log(`Untouched (no rule applied):             ${untouched}`)

  await prisma.$disconnect()
}

function maskConnectionString(url: string): string {
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.hostname}:${u.port}${u.pathname}`
  } catch {
    return "<unparseable DATABASE_URL>"
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

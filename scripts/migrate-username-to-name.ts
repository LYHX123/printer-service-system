/**
 * One-time backfill for the Name-based login migration.
 *
 * Rules (per the upgrade spec):
 *   - If a User already has a non-empty `name`, it is left untouched and used
 *     as-is as the new login identifier.
 *   - If `name` is empty/blank, it is filled from the legacy `username`.
 *   - If two users in the same company would end up with the same `name`,
 *     all but the first (by createdAt) get a numeric suffix appended
 *     (" (2)", " (3)", …) so the new uniqueness rule never locks anyone out.
 *   - Password hashes are never touched. The `username` column itself is
 *     left in place (not dropped) — it's simply no longer read by the app.
 *
 * Safe to re-run: rows with an already-unique, non-empty name are no-ops.
 *
 * Run with: npx tsx scripts/migrate-username-to-name.ts
 */
import "dotenv/config"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, companyId: true, name: true, username: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })

  const backfilledFromUsername: string[] = []
  const suffixed: string[] = []

  // Step 1: fill blank names from username.
  const working = users.map((u) => {
    const trimmedName = u.name?.trim() ?? ""
    if (trimmedName) return { ...u, name: trimmedName }
    const fallback = (u.username ?? "").trim() || `user-${u.id.slice(0, 8)}`
    backfilledFromUsername.push(`${u.id} -> "${fallback}"`)
    return { ...u, name: fallback }
  })

  // Step 2: dedupe within each company, keeping the earliest-created row unsuffixed.
  const seenPerCompany = new Map<string, Set<string>>()
  const finalNames = new Map<string, string>() // userId -> final name

  for (const u of working) {
    const seen = seenPerCompany.get(u.companyId) ?? new Set<string>()
    seenPerCompany.set(u.companyId, seen)

    let candidate = u.name
    if (seen.has(candidate)) {
      let n = 2
      while (seen.has(`${u.name} (${n})`)) n++
      candidate = `${u.name} (${n})`
      suffixed.push(`${u.id} "${u.name}" -> "${candidate}"`)
    }
    seen.add(candidate)
    finalNames.set(u.id, candidate)
  }

  // Step 3: write back only the rows that actually changed.
  let updated = 0
  for (const u of users) {
    const finalName = finalNames.get(u.id)!
    if (finalName !== (u.name ?? "")) {
      await prisma.user.update({ where: { id: u.id }, data: { name: finalName } })
      updated++
    }
  }

  console.log(`Checked ${users.length} user(s).`)
  console.log(`Backfilled from username: ${backfilledFromUsername.length}`)
  backfilledFromUsername.forEach((line) => console.log(`  ${line}`))
  console.log(`Suffixed for uniqueness: ${suffixed.length}`)
  suffixed.forEach((line) => console.log(`  ${line}`))
  console.log(`Rows updated: ${updated}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })

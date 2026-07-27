/**
 * Read-only report of possibly-duplicate Customer companies (same company
 * name, ignoring case/whitespace). Does NOT merge, update, or delete
 * anything — it only prints a report for manual review.
 *
 * Run with: npx tsx scripts/report-duplicate-customers.ts
 */
import "dotenv/config"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

function normalize(name: string): string {
  return name.trim().toLowerCase()
}

async function main() {
  const customers = await prisma.customer.findMany({
    where: { isActive: true },
    select: { id: true, code: true, companyName: true, pinNumber: true, name: true, phone: true, companyId: true },
    orderBy: { createdAt: "asc" },
  })

  const groups = new Map<string, typeof customers>()
  for (const c of customers) {
    const key = `${c.companyId}::${normalize(c.companyName)}`
    const group = groups.get(key) ?? []
    group.push(c)
    groups.set(key, group)
  }

  const duplicateGroups = [...groups.values()].filter((g) => g.length > 1)

  console.log(`Scanned ${customers.length} active customers. Found ${duplicateGroups.length} possible duplicate group(s).\n`)

  if (duplicateGroups.length === 0) {
    console.log("No duplicates found.")
    await prisma.$disconnect()
    return
  }

  for (const group of duplicateGroups) {
    const pins = new Set(group.map((c) => c.pinNumber?.trim()).filter((p): p is string => Boolean(p)))
    const conflict = pins.size > 1

    console.log(`── "${group[0].companyName}" — ${group.length} records ${conflict ? "[PIN CONFLICT — do not merge automatically]" : "[compatible PINs — mergeable]"}`)
    for (const c of group) {
      console.log(`   ${c.id}  code=${c.code}  pin=${c.pinNumber ?? "(blank)"}  contact=${c.name ?? "(blank)"}  phone=${c.phone ?? "(blank)"}`)
    }
    console.log("")
  }

  console.log("No data was changed. This is a report only — review the list above and decide on merging later.")
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

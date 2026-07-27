/**
 * One-time backfill: populates SalesLedgerEntry.referenceYear /
 * referenceSequence for existing rows so the Sales Record list can sort by
 * reference number, newest first. Only ever sets these two previously-null
 * columns — never touches any other data. Safe to re-run.
 *
 * Run with: npx tsx scripts/backfill-sales-ledger-reference.ts
 */
import "dotenv/config"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"
import { parseSalesReference } from "../src/lib/ledger-reference"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const BATCH_SIZE = 200

async function main() {
  const rows = await prisma.salesLedgerEntry.findMany({
    select: { id: true, orderNo: true, date: true },
  })

  console.log(`Found ${rows.length} SalesLedgerEntry rows.`)

  const unparsed: { id: string; orderNo: string | null; date: Date }[] = []
  let updated = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    await prisma.$transaction(
      batch.map((row) => {
        const { referenceYear, referenceSequence } = parseSalesReference(row.orderNo, row.date)
        if (referenceYear === null && referenceSequence === null) {
          unparsed.push(row)
        }
        return prisma.salesLedgerEntry.update({
          where: { id: row.id },
          data: { referenceYear, referenceSequence },
        })
      })
    )
    updated += batch.length
    console.log(`  ...${updated}/${rows.length} processed`)
  }

  console.log(`\nDone. ${rows.length - unparsed.length} rows parsed, ${unparsed.length} unparsed (left NULL, will sort last).`)

  if (unparsed.length > 0) {
    console.log("\nUnparsed rows (id | orderNo | date):")
    for (const row of unparsed) {
      console.log(`  ${row.id} | ${JSON.stringify(row.orderNo)} | ${row.date.toISOString().slice(0, 10)}`)
    }
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

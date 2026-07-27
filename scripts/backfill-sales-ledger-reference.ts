/**
 * Idempotent backfill: populates SalesLedgerEntry.referenceYear (a sortable
 * year+month period, see src/lib/ledger-reference.ts) and
 * referenceSequence for rows where either is still NULL, by parsing the
 * existing `orderNo`.
 *
 * Safety guarantees:
 *   - Only ever writes referenceYear/referenceSequence — orderNo, amounts,
 *     dates, customer, and payment status are never touched.
 *   - Only touches rows where referenceYear OR referenceSequence is NULL.
 *     A row that already has both fields populated is left completely
 *     alone (reported as "skipped"), so this is safe to run repeatedly —
 *     including against production, after a deploy — without re-writing
 *     rows or clobbering a value someone corrected by hand.
 *   - Never deletes or rejects a row it can't parse; unparseable rows are
 *     left NULL (they sort last) and are listed individually in the report.
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
  const allRows = await prisma.salesLedgerEntry.findMany({
    select: { id: true, orderNo: true, date: true, referenceYear: true, referenceSequence: true },
  })

  const alreadyPopulated = allRows.filter(
    (r) => r.referenceYear !== null && r.referenceSequence !== null
  )
  const needsBackfill = allRows.filter(
    (r) => r.referenceYear === null || r.referenceSequence === null
  )

  console.log(`Total rows checked: ${allRows.length}`)
  console.log(`Already populated (will be skipped, untouched): ${alreadyPopulated.length}`)
  console.log(`Rows needing backfill: ${needsBackfill.length}`)

  let parsedCount = 0
  const unparsed: { id: string; orderNo: string | null; date: Date }[] = []

  for (let i = 0; i < needsBackfill.length; i += BATCH_SIZE) {
    const batch = needsBackfill.slice(i, i + BATCH_SIZE)
    await prisma.$transaction(
      batch.map((row) => {
        const { referenceYear, referenceSequence } = parseSalesReference(row.orderNo, row.date)
        if (referenceYear === null && referenceSequence === null) {
          unparsed.push(row)
        } else {
          parsedCount++
        }
        return prisma.salesLedgerEntry.update({
          where: { id: row.id },
          data: { referenceYear, referenceSequence },
        })
      })
    )
    console.log(`  ...${Math.min(i + BATCH_SIZE, needsBackfill.length)}/${needsBackfill.length} processed`)
  }

  console.log(`\n=== Summary ===`)
  console.log(`Total rows checked:        ${allRows.length}`)
  console.log(`Skipped (already populated): ${alreadyPopulated.length}`)
  console.log(`Successfully parsed:       ${parsedCount}`)
  console.log(`Unparseable (left NULL):   ${unparsed.length}`)

  if (unparsed.length > 0) {
    console.log(`\nUnparseable rows (id | orderNo | date) — left NULL, will sort last:`)
    for (const row of unparsed) {
      console.log(`  ${row.id} | ${JSON.stringify(row.orderNo)} | ${row.date.toISOString().slice(0, 10)}`)
    }
  }

  console.log(`\nDone. No orderNo, amount, date, customer, or payment-status values were modified.`)
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

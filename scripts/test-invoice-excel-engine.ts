/**
 * Standalone regression test for the dedicated Invoice Excel engine
 * (src/lib/invoiceExcel). Not wired into the Invoice module — run
 * directly with:
 *   npx tsx -r dotenv/config scripts/test-invoice-excel-engine.ts
 */
import ExcelJS from "exceljs"
import { prisma } from "@/lib/prisma"
import { getStockType } from "@/lib/stock-types"
import { extractTrailingNumber } from "@/lib/numbering"
import { generateInvoiceExcel } from "@/lib/invoiceExcel"
import { getInvoiceForPdf, type InvoicePdfData } from "@/lib/data/invoices"

async function inspect(label: string, filePath: string) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(filePath)
  const sheet = wb.worksheets[0]

  let leftover = 0
  sheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      const v = cell.value
      const text = typeof v === "string" ? v : (v && typeof v === "object" && "richText" in v ? (v as { richText: { text: string }[] }).richText.map((r) => r.text).join("") : "")
      if (text.includes("{{") && text.includes("}}")) leftover++
    })
  })

  let subtotalRow = -1
  for (let r = 7; r <= sheet.rowCount; r++) {
    if (typeof sheet.getCell(`F${r}`).value === "string" && String(sheet.getCell(`F${r}`).value).includes("Subtotal")) subtotalRow = r
  }
  const heights = new Set<number>()
  for (let r = 7; r < (subtotalRow === -1 ? 17 : subtotalRow); r++) heights.add(sheet.getRow(r).height ?? -1)

  console.log(`\n=== ${label} ===`)
  console.log("leftover {{placeholders}}:", leftover === 0 ? "none (OK)" : `${leftover} FOUND - BUG`)
  console.log("date:", sheet.getCell("F3").value)
  console.log("invoice no:", sheet.getCell("F4").value)
  console.log("customer:", sheet.getCell("D3").value)
  console.log("subtotal row:", subtotalRow, "| uniform product row heights:", [...heights])
  console.log("G(subtotal/vat/total):", sheet.getCell(`G${subtotalRow}`).value, sheet.getCell(`G${subtotalRow + 1}`).value, sheet.getCell(`G${subtotalRow + 2}`).value)
  for (let r = 7; r <= Math.min(subtotalRow - 1, 10); r++) {
    console.log(`  row${r}: ITEM_NAME="${sheet.getCell(`B${r}`).value}" DESC="${sheet.getCell(`C${r}`).value}" UNIT="${sheet.getCell(`D${r}`).value}" QTY=${sheet.getCell(`E${r}`).value}(${typeof sheet.getCell(`E${r}`).value})`)
  }
}

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true } })
  if (!company) throw new Error("No company")
  const customer = await prisma.customer.findFirst({ where: { companyId: company.id }, select: { id: true } })
  const user = await prisma.user.findFirst({ where: { companyId: company.id }, select: { id: true } })
  const parts = await prisma.sparePart.findMany({
    where: { companyId: company.id },
    select: { id: true, name: true, brand: true, model: true, specification: true, category: true, unit: true },
    take: 3,
  })
  console.log("Parts:", parts.map((p) => ({ name: p.name, stockType: getStockType(p.category) })))

  // ===== A. Direct Invoice / 3 items (PART, EQUIPMENT, CONSUMPTION) =====
  async function makeDirectInvoice(suffix: string, itemCount: number) {
    const invoiceNumber = "CNTEST" + suffix + Math.floor(Math.random() * 900 + 100)
    const partMap = new Map(parts.map((p) => [p.id, p]))
    const items = Array.from({ length: itemCount }, (_, i) => ({
      partId: parts[i % parts.length].id,
      quantity: i + 1,
      unitPrice: 100 * (i + 1),
    }))
    const subtotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0)
    const vatAmount = subtotal * 0.16
    const totalAmount = subtotal + vatAmount

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        invoiceSortNumber: extractTrailingNumber(invoiceNumber),
        source: "DIRECT",
        status: "DRAFT",
        companyId: company!.id,
        customerId: customer!.id,
        date: new Date(),
        subtotal,
        vatPercent: 16,
        vatAmount,
        totalAmount,
        createdById: user!.id,
        items: {
          create: items.map((item) => {
            const part = partMap.get(item.partId)!
            return {
              partId: item.partId,
              description: [part.brand, part.name].filter(Boolean).join(" "),
              unit: part.unit,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              amount: item.quantity * item.unitPrice,
              stockCategory: getStockType(part.category),
              brandSnapshot: part.brand,
              nameSnapshot: part.name,
              modelSnapshot: part.model,
              specificationSnapshot: part.specification,
            }
          }),
        },
      },
      select: { id: true },
    })
    return invoice.id
  }

  const idA = await makeDirectInvoice("A3", 3)
  const detailA = (await getInvoiceForPdf(idA, company.id)) as InvoicePdfData
  await inspect("A. Direct Invoice, 3 items (PART/EQUIPMENT/CONSUMPTION)", await generateInvoiceExcel(detailA))

  const idC = await makeDirectInvoice("C10", 10)
  const detailC = (await getInvoiceForPdf(idC, company.id)) as InvoicePdfData
  await inspect("C. Direct Invoice, 10 items (expect no insertion)", await generateInvoiceExcel(detailC))

  const idD = await makeDirectInvoice("D12", 12)
  const detailD = (await getInvoiceForPdf(idD, company.id)) as InvoicePdfData
  await inspect("D. Direct Invoice, 12 items (expect 2 rows inserted)", await generateInvoiceExcel(detailD))

  // ===== E. Long description =====
  {
    const invoiceNumber = "CNTESTE" + Math.floor(Math.random() * 900 + 100)
    const part = parts[0]
    const longSpec = "Compatible with HP LaserJet Pro M501/M506/M527. High-yield, ~12000 pages at 5% coverage. Genuine OEM part, not remanufactured. ".repeat(2)
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        invoiceSortNumber: extractTrailingNumber(invoiceNumber),
        source: "DIRECT",
        status: "DRAFT",
        companyId: company.id,
        customerId: customer!.id,
        date: new Date(),
        subtotal: 100,
        vatPercent: 16,
        vatAmount: 16,
        totalAmount: 116,
        createdById: user!.id,
        items: {
          create: [{
            partId: part.id,
            description: "test",
            unit: part.unit,
            quantity: 1,
            unitPrice: 100,
            amount: 100,
            stockCategory: getStockType(part.category),
            brandSnapshot: part.brand,
            nameSnapshot: "Extremely Long Product Name For Wrap Testing Purposes",
            modelSnapshot: part.model,
            specificationSnapshot: longSpec,
          }],
        },
      },
      select: { id: true },
    })
    const detail = (await getInvoiceForPdf(invoice.id, company.id)) as InvoicePdfData
    await inspect("E. Long description (expect increased uniform height)", await generateInvoiceExcel(detail))
    await prisma.invoiceItem.deleteMany({ where: { invoiceId: invoice.id } })
    await prisma.invoice.delete({ where: { id: invoice.id } })
  }

  // ===== B. Quotation -> Invoice (use a real existing one if present) =====
  const fromQuotationInvoice = await prisma.invoice.findFirst({
    where: { companyId: company.id, source: "FROM_QUOTATION" },
    select: { id: true, invoiceNumber: true },
  })
  if (fromQuotationInvoice) {
    const detail = (await getInvoiceForPdf(fromQuotationInvoice.id, company.id)) as InvoicePdfData
    await inspect(`B. Quotation -> Invoice (real: ${fromQuotationInvoice.invoiceNumber})`, await generateInvoiceExcel(detail))
  } else {
    console.log("\n(No FROM_QUOTATION invoice found in dev DB to test scenario B)")
  }

  // ===== F. Historical Invoice fallback (real, no snapshot data) =====
  const historicalInvoice = await prisma.invoice.findFirst({
    where: { companyId: company.id },
    select: { id: true, invoiceNumber: true, items: { select: { stockCategory: true, partId: true } } },
  })
  const noSnapshotInvoice = await prisma.invoice.findFirst({
    where: {
      companyId: company.id,
      items: { some: { stockCategory: null } },
    },
    select: { id: true, invoiceNumber: true },
  })
  if (noSnapshotInvoice) {
    const detail = (await getInvoiceForPdf(noSnapshotInvoice.id, company.id)) as InvoicePdfData
    await inspect(`F. Historical Invoice, no snapshot (real: ${noSnapshotInvoice.invoiceNumber})`, await generateInvoiceExcel(detail))
  } else if (historicalInvoice) {
    console.log(`\n(No invoice with missing snapshot found; using ${historicalInvoice.invoiceNumber} as historical test anyway)`)
    const detail = (await getInvoiceForPdf(historicalInvoice.id, company.id)) as InvoicePdfData
    await inspect(`F. Historical Invoice (real: ${historicalInvoice.invoiceNumber})`, await generateInvoiceExcel(detail))
  }

  // Cleanup synthetic invoices
  for (const id of [idA, idC, idD]) {
    await prisma.invoiceItem.deleteMany({ where: { invoiceId: id } })
    await prisma.invoice.delete({ where: { id } })
  }
  console.log("\nCleaned up synthetic test invoices.")

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error("TEST FAILED:", err)
  await prisma.$disconnect()
  process.exit(1)
})

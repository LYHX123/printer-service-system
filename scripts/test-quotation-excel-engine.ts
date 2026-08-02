/**
 * Standalone regression test for the dedicated Quotation Excel engine
 * (src/lib/quotationExcel). Not wired into the Quotation module — run
 * directly with:
 *   npx tsx -r dotenv/config scripts/test-quotation-excel-engine.ts
 *
 * Loads a real quotation from the local dev DB and generates several
 * variants of it (item count, long text, pictures) to exercise: minimum
 * 10-row padding, >10-row insertion + footer shift, uniform row height,
 * picture embedding (aspect ratio + positioning), Description composition,
 * and Subtotal/VAT/Total numeric correctness.
 */
import { mkdir } from "fs/promises"
import path from "path"
import sharp from "sharp"
import ExcelJS from "exceljs"
import { prisma } from "@/lib/prisma"
import { getQuotationForPdf, type QuotationPdfData, type QuotationItemWithPart } from "@/lib/data/quotations"
import { generateQuotationExcel } from "@/lib/quotationExcel"

async function makeTestImages(): Promise<{ wide: string; square: string }> {
  const dir = path.join(process.cwd(), "public", "uploads", "test-picture-verification")
  await mkdir(dir, { recursive: true })
  await sharp({ create: { width: 400, height: 200, channels: 3, background: { r: 220, g: 50, b: 50 } } })
    .jpeg()
    .toFile(path.join(dir, "wide.jpg"))
  await sharp({ create: { width: 300, height: 300, channels: 3, background: { r: 50, g: 80, b: 220 } } })
    .png()
    .toFile(path.join(dir, "square.png"))
  return { wide: "/uploads/test-picture-verification/wide.jpg", square: "/uploads/test-picture-verification/square.png" }
}

function makeItem(overrides: Partial<QuotationItemWithPart>): QuotationItemWithPart {
  return {
    id: "test-" + Math.random().toString(36).slice(2),
    quotationId: "test-quotation",
    partId: null,
    description: null,
    quantity: 1,
    unitPrice: 100 as unknown as QuotationItemWithPart["unitPrice"],
    subtotal: 100 as unknown as QuotationItemWithPart["subtotal"],
    stockCategory: "PARTS",
    brandSnapshot: "HP",
    nameSnapshot: "Test Item",
    modelSnapshot: null,
    specificationSnapshot: null,
    unitSnapshot: "PCS",
    pictureSnapshot: null,
    createdAt: new Date(),
    part: null,
    ...overrides,
  } as QuotationItemWithPart
}

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

  // Non-logo images: the template's own logo always anchors at nativeRow 0; anything else is a product picture.
  const productImages = sheet.getImages().filter((img) => {
    const r = img.range as unknown as { tl: { nativeRow: number } }
    return r.tl.nativeRow !== 0
  })

  console.log(`\n=== ${label} ===`)
  console.log("leftover {{placeholders}}:", leftover === 0 ? "none (OK)" : `${leftover} FOUND — BUG`)
  console.log("subtotal row:", subtotalRow, "| uniform product row heights:", [...heights])
  console.log("product pictures embedded:", productImages.length, "| G(subtotal/vat/total):", sheet.getCell(`G${subtotalRow}`).value, sheet.getCell(`G${subtotalRow + 1}`).value, sheet.getCell(`G${subtotalRow + 2}`).value)
}

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true } })
  if (!company) throw new Error("No company in dev DB")
  const realQuotation = await prisma.quotation.findFirst({ where: { companyId: company.id }, select: { id: true } })
  if (!realQuotation) throw new Error("No quotation in dev DB")
  const base = (await getQuotationForPdf(realQuotation.id, company.id)) as QuotationPdfData
  const images = await makeTestImages()

  const scenarios: { label: string; suffix: string; items: QuotationItemWithPart[] }[] = [
    { label: "A. 3 items -> 10 rows padded", suffix: "T3", items: [1, 2, 3].map((n) => makeItem({ quantity: n })) },
    { label: "B. exactly 10 items -> no insertion", suffix: "T10", items: Array.from({ length: 10 }, (_, i) => makeItem({ quantity: i + 1 })) },
    { label: "C. 12 items -> 2 rows inserted, footer shifts", suffix: "T12", items: Array.from({ length: 12 }, (_, i) => makeItem({ quantity: i + 1 })) },
    {
      label: "D. Long description -> uniform height increases",
      suffix: "TLONG",
      items: [makeItem({ specificationSnapshot: "Compatible with HP LaserJet Pro M501/M506/M527. High-yield, ~12000 pages at 5% coverage. Genuine OEM part, not remanufactured. ".repeat(2), nameSnapshot: "Extremely Long Product Name For Wrap Testing" })],
    },
    {
      label: "E. Pictures: wide + square + none",
      suffix: "TPIC",
      items: [
        makeItem({ pictureSnapshot: images.wide, nameSnapshot: "Wide Picture Item" }),
        makeItem({ pictureSnapshot: images.square, nameSnapshot: "Square Picture Item" }),
        makeItem({ pictureSnapshot: null, nameSnapshot: "No Picture Item" }),
      ],
    },
    {
      label: "F. Amount calc (2x10000 + 3x5000 = 35000 subtotal)",
      suffix: "TAMT",
      items: [
        makeItem({ quantity: 2, unitPrice: 10000 as unknown as QuotationItemWithPart["unitPrice"], subtotal: 20000 as unknown as QuotationItemWithPart["subtotal"] }),
        makeItem({ quantity: 3, unitPrice: 5000 as unknown as QuotationItemWithPart["unitPrice"], subtotal: 15000 as unknown as QuotationItemWithPart["subtotal"] }),
      ],
    },
    {
      label: "G. Description: Brand=HP, Name=Test Item, Model empty, Spec='A4 Color' -> 'HP / Test Item / A4 Color'",
      suffix: "TEDGE",
      items: [makeItem({ brandSnapshot: "HP", modelSnapshot: null, specificationSnapshot: "A4 Color" })],
    },
  ]

  let edgeCasePath = ""
  for (const scenario of scenarios) {
    const subtotal = scenario.items.reduce((sum, i) => sum + Number(i.subtotal), 0)
    const quotation = {
      ...base,
      quotationNumber: base.quotationNumber + "-" + scenario.suffix,
      subtotal: subtotal as unknown as QuotationPdfData["subtotal"],
      totalCost: (subtotal * 1.16) as unknown as QuotationPdfData["totalCost"],
      items: scenario.items,
    }
    const outPath = await generateQuotationExcel(quotation as QuotationPdfData)
    await inspect(scenario.label, outPath)
    if (scenario.suffix === "TEDGE") edgeCasePath = outPath
  }

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(edgeCasePath)
  console.log("\nDescription edge-case cell C7:", JSON.stringify(wb.worksheets[0].getCell("C7").value))

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error("TEST FAILED:", err)
  await prisma.$disconnect()
  process.exit(1)
})

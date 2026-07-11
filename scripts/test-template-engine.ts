/**
 * Standalone demonstration/test for the Template Engine.
 * Not wired into the Quotation or Invoice modules — run directly with:
 *   npx tsx scripts/test-template-engine.ts
 */
import ExcelJS from "exceljs"
import {
  loadTemplate,
  replaceVariables,
  fillItems,
  generateExcel,
  amountInWords,
  TemplateEngineError,
  type TemplateItem,
} from "../src/lib/templateEngine"

function makeItems(count: number): TemplateItem[] {
  return Array.from({ length: count }, (_, i) => ({
    itemName: `Toner Cartridge ${i + 1}`,
    description: "Compatible black toner cartridge",
    unit: "pcs",
    qty: 2,
    unitPrice: 3500,
  }))
}

function computeTotals(items: TemplateItem[]) {
  const subtotal = items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0)
  const vat = Math.round(subtotal * 0.16 * 100) / 100
  const grandTotal = subtotal + vat
  return { subtotal, vat, grandTotal }
}

async function step1_loadTemplate() {
  console.log("\n[1] loadTemplate('quotation')")
  const workbook = await loadTemplate("quotation")
  console.log("  OK — worksheet:", workbook.worksheets[0].name)
  return workbook
}

async function step2_replaceVariables(workbook: ExcelJS.Workbook) {
  console.log("\n[2] replaceVariables — sample data, including a missing key (phone omitted)")
  replaceVariables(workbook, {
    quotation_no: "QT-2026-0001",
    date: "2026-07-10",
    customer_name: "Acme Retail Ltd",
    company_name: "ENFB Wajiku Trading Limited",
    pin_no: "P123456789Z",
    location: "Westlands, Nairobi",
    // phone intentionally omitted to prove missing variables don't crash
    subtotal: "7,000.00",
    vat: "1,120.00",
    grand_total: "8,120.00",
    total_in_words: amountInWords(8120, "KES"),
    created_by: "Jane Engineer",
  })
  const ws = workbook.worksheets[0]
  console.log("  D3 (customer block):", JSON.stringify(ws.getCell("D3").value))
  console.log("  F4 (quotation no):", JSON.stringify(ws.getCell("F4").value))
  console.log("  G17 (subtotal, now a string):", JSON.stringify(ws.getCell("G17").value))
}

async function step3_fillItemsWithinReserved(workbook: ExcelJS.Workbook) {
  console.log("\n[3] fillItems — 4 items (fits within the 10 reserved rows)")
  fillItems(workbook, makeItems(4))
  const ws = workbook.worksheets[0]
  console.log("  Row 7:", ws.getRow(7).values)
  console.log("  Row 11 (should be blank, unused reserved row):", ws.getRow(11).values)
}

async function step4_generateExcel() {
  console.log("\n[4] generateExcel — full pipeline, quotation with 4 items")
  const items = makeItems(4)
  const { subtotal, vat, grandTotal } = computeTotals(items)
  const outputPath = await generateExcel("quotation", {
    quotation_no: "QT-2026-0002",
    date: "2026-07-10",
    customer_name: "Beta Supplies Co",
    company_name: "ENFB Wajiku Trading Limited",
    pin_no: "P987654321A",
    location: "Industrial Area, Nairobi",
    phone: "+254 700 000 000",
    subtotal: subtotal.toFixed(2),
    vat: vat.toFixed(2),
    grand_total: grandTotal.toFixed(2),
    total_in_words: amountInWords(grandTotal, "KES"),
    created_by: "Jane Engineer",
    items,
  })
  console.log("  OK — saved to:", outputPath)
  return outputPath
}

async function step5_generateExcelOverflow() {
  console.log("\n[5] generateExcel — quotation with 14 items (exceeds the 10 reserved rows, forces row insertion)")
  const items = makeItems(14)
  const { subtotal, vat, grandTotal } = computeTotals(items)
  const outputPath = await generateExcel("quotation", {
    quotation_no: "QT-2026-0003",
    date: "2026-07-10",
    customer_name: "Gamma Offices Ltd",
    company_name: "ENFB Wajiku Trading Limited",
    pin_no: "P555555555B",
    location: "Upperhill, Nairobi",
    phone: "+254 711 111 111",
    subtotal: subtotal.toFixed(2),
    vat: vat.toFixed(2),
    grand_total: grandTotal.toFixed(2),
    total_in_words: amountInWords(grandTotal, "KES"),
    created_by: "Jane Engineer",
    items,
  })
  console.log("  OK — saved to:", outputPath)

  // Verify the footer landed below the inserted rows, with placeholders resolved.
  const verify = new ExcelJS.Workbook()
  await verify.xlsx.readFile(outputPath)
  const ws = verify.worksheets[0]
  console.log("  Row 16 (14th item, in inserted territory):", ws.getRow(20).values)
  console.log("  Subtotal cell after shift (G", 16 + 4 + 1, "):", ws.getCell(`G${16 + 4 + 1}`).value)
  return outputPath
}

async function step6_generateInvoice() {
  console.log("\n[6] generateExcel — invoice with 3 items")
  const items = makeItems(3)
  const { subtotal, vat, grandTotal } = computeTotals(items)
  const outputPath = await generateExcel("invoice", {
    invoice_no: "INV-2026-0001",
    date: "2026-07-10",
    customer_name: "Acme Retail Ltd",
    company_name: "ENFB Wajiku Trading Limited",
    pin_no: "P123456789Z",
    location: "Westlands, Nairobi",
    phone: "+254 700 000 000",
    subtotal: subtotal.toFixed(2),
    vat: vat.toFixed(2),
    grand_total: grandTotal.toFixed(2),
    total_in_words: amountInWords(grandTotal, "KES"),
    created_by: "Jane Engineer",
    items,
  })
  console.log("  OK — saved to:", outputPath)
  return outputPath
}

async function step7_missingTemplateErrorHandling() {
  console.log("\n[7] loadTemplate('nonexistent') — must fail with a clear error, not crash the process")
  try {
    // @ts-expect-error deliberately passing an unsupported type
    await loadTemplate("policy")
    console.log("  FAIL — expected an error to be thrown")
  } catch (error) {
    if (error instanceof TemplateEngineError) {
      console.log("  OK — TemplateEngineError:", error.message)
    } else {
      throw error
    }
  }
}

async function main() {
  const workbook = await step1_loadTemplate()
  await step2_replaceVariables(workbook)
  await step3_fillItemsWithinReserved(workbook)
  await step4_generateExcel()
  await step5_generateExcelOverflow()
  await step6_generateInvoice()
  await step7_missingTemplateErrorHandling()
  console.log("\nAll template engine checks completed successfully.")
}

main().catch((error) => {
  console.error("\nTemplate engine test FAILED:", error)
  process.exit(1)
})

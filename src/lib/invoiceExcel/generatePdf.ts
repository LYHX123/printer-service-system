import { convertExcelToPdf, PdfConversionUnavailableError } from "@/lib/templateEngine"
import { generateInvoiceExcel } from "./generate"
import type { InvoicePdfData } from "@/lib/data/invoices"

/**
 * Generates an Invoice PDF by running it through the same dedicated Excel
 * engine as the "Download Excel" button, then converting that .xlsx with
 * LibreOffice — mirrors quotationExcel/generatePdf.ts. Throws
 * PdfConversionUnavailableError when LibreOffice isn't available locally;
 * the caller falls back to the old react-pdf generator.
 */
export async function generateInvoicePdf(invoice: InvoicePdfData): Promise<string> {
  const excelPath = await generateInvoiceExcel(invoice)
  return convertExcelToPdf(excelPath)
}

export { PdfConversionUnavailableError }

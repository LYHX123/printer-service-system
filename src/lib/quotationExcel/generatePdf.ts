import { convertExcelToPdf, PdfConversionUnavailableError } from "@/lib/templateEngine"
import { generateQuotationExcel } from "./generate"
import type { QuotationPdfData } from "@/lib/data/quotations"

/**
 * Generates a Quotation PDF by running it through the same dedicated Excel
 * engine as the "Download Excel" button, then converting that .xlsx with
 * LibreOffice — so the primary PDF path always matches the Excel output
 * exactly (same template, same placeholders, same picture/row-height
 * logic). Throws PdfConversionUnavailableError when LibreOffice isn't
 * available locally; the caller falls back to the old react-pdf generator.
 */
export async function generateQuotationPdf(quotation: QuotationPdfData): Promise<string> {
  const excelPath = await generateQuotationExcel(quotation)
  return convertExcelToPdf(excelPath)
}

export { PdfConversionUnavailableError }

import { convertExcelToPdf, PdfConversionUnavailableError } from "@/lib/templateEngine"
import { generateDeliveryExcel } from "./generate"
import type { DeliveryPdfData } from "@/lib/data/deliveries"

/**
 * Generates a Delivery Note PDF by running it through the same dedicated
 * Excel engine as the "Download Excel" button, then converting that .xlsx
 * with LibreOffice — mirrors invoiceExcel/generatePdf.ts. Throws
 * PdfConversionUnavailableError when LibreOffice isn't available locally;
 * callers should surface that as a clear error (there is no legacy
 * react-pdf fallback renderer for Delivery Notes — this is the only PDF path).
 */
export async function generateDeliveryPdf(delivery: DeliveryPdfData): Promise<string> {
  const excelPath = await generateDeliveryExcel(delivery)
  return convertExcelToPdf(excelPath)
}

export { PdfConversionUnavailableError }

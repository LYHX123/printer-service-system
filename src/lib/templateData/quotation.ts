import { format } from "date-fns"
import { amountInWords } from "@/lib/templateEngine"
import type { GenerateExcelData, TemplateItem } from "@/lib/templateEngine"
import type { QuotationPdfData } from "@/lib/data/quotations"

/**
 * Maps a quotation record to the Template Engine's data shape. Shared by
 * the Quotation Excel export route and the Quotation PDF route (which
 * generates a PDF from the same Excel template) so both stay in sync.
 */
export function buildQuotationExcelData(quotation: QuotationPdfData): GenerateExcelData {
  const subtotal = Number(quotation.subtotal)
  const vatPercent = Number(quotation.vatPercent)
  const vatAmount = (subtotal * vatPercent) / 100
  const grandTotal = Number(quotation.totalCost)

  // Same item-display logic as the PDF: a stock-linked part's brand/name,
  // or the free-text description for legacy items with no linked part.
  const items: TemplateItem[] = quotation.items.map((item) => ({
    itemName: item.part
      ? item.part.brand
        ? `${item.part.brand} ${item.part.name}`
        : item.part.name
      : item.description,
    description: item.part?.partNumber ?? null,
    unit: item.part?.unit ?? null,
    qty: item.quantity,
    unitPrice: Number(item.unitPrice),
  }))

  return {
    quotation_no: quotation.quotationNumber,
    date: format(new Date(quotation.createdAt), "dd MMM yyyy"),
    customer_name: quotation.customer.companyName,
    company_name: quotation.company.name,
    pin_no: quotation.customer.pinNumber,
    // phone/location intentionally omitted: the template only has one
    // shared customer-info cell, with no dedicated line for them, so
    // supplying them would visually run them together with customer_name.
    subtotal,
    vat: vatAmount,
    grand_total: grandTotal,
    total_in_words: amountInWords(grandTotal, quotation.company.currency),
    created_by: quotation.createdBy?.name,
    items,
  }
}

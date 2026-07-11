import { format } from "date-fns"
import { amountInWords } from "@/lib/templateEngine"
import type { GenerateExcelData, TemplateItem } from "@/lib/templateEngine"
import type { InvoicePdfData } from "@/lib/data/invoices"

/**
 * Maps an invoice record to the Template Engine's data shape. Shared by
 * the Invoice Excel export route and the Invoice PDF route (which
 * generates a PDF from the same Excel template) so both stay in sync.
 */
export function buildInvoiceExcelData(invoice: InvoicePdfData): GenerateExcelData {
  const subtotal = Number(invoice.subtotal)
  const vatAmount = Number(invoice.vatAmount)
  const grandTotal = Number(invoice.totalAmount)
  const pinNo = invoice.customerPin || invoice.customer.pinNumber

  // The invoice template's columns are "ITEM NO" then "Description" (unlike
  // the quotation template's "Item Name"/"Desceiption" pair), matching what
  // the existing Invoice PDF already shows: part number in the first
  // column, the item's own description text in the second.
  const items: TemplateItem[] = invoice.items.map((item) => ({
    itemName: item.part?.partNumber ?? null,
    description: item.description,
    unit: item.unit,
    qty: item.quantity,
    unitPrice: Number(item.unitPrice),
  }))

  return {
    invoice_no: invoice.invoiceNumber,
    date: format(new Date(invoice.date), "dd MMM yyyy"),
    customer_name: invoice.customer.companyName,
    company_name: invoice.company.name,
    pin_no: pinNo,
    // phone/location intentionally omitted, same reasoning as the
    // quotation mapping: no dedicated line for them in the template.
    subtotal,
    vat: vatAmount,
    grand_total: grandTotal,
    total_in_words: amountInWords(grandTotal, invoice.company.currency),
    created_by: invoice.createdBy?.name,
    items,
  }
}

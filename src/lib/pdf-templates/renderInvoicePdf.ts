import { format } from "date-fns"
import type { InvoicePdfData } from "@/lib/data/invoices"
import { INVOICE_TEMPLATES, ACTIVE_INVOICE_TEMPLATE_VERSION } from "./invoiceTemplateMap"
import { createDocumentFromTemplate, drawSpot, drawWrappedSpot, drawFixedSlotLines, formatAmount } from "./engine"

export async function renderInvoicePdf(invoice: InvoicePdfData, preparedByName: string): Promise<Buffer> {
  const map = INVOICE_TEMPLATES[ACTIVE_INVOICE_TEMPLATE_VERSION]
  const rowsPerPage = map.itemRows.length
  const pageCount = Math.max(1, Math.ceil(invoice.items.length / rowsPerPage))
  const { pdf, pages, fonts } = await createDocumentFromTemplate(map.file, pageCount)

  const dateText = format(new Date(invoice.date), "dd MMM yyyy")
  const customerPin = invoice.customerPin || invoice.customer.pinNumber

  for (const page of pages) {
    drawFixedSlotLines(page, invoice.customer.companyName, map.customerNameLines, fonts, true)
    if (invoice.customer.location) drawWrappedSpot(page, invoice.customer.location, map.customerAddress, 0, 1, fonts)
    drawSpot(page, customerPin || "—", map.customerPin, fonts)
    drawSpot(page, dateText, map.date, fonts)
    drawSpot(page, invoice.invoiceNumber, map.documentNumber, fonts)
  }

  for (let i = 0; i < invoice.items.length; i++) {
    const item = invoice.items[i]
    const page = pages[Math.floor(i / rowsPerPage)]
    const spots = map.itemRows[i % rowsPerPage]

    if (item.part?.partNumber) drawSpot(page, item.part.partNumber, spots.itemNo, fonts)
    drawWrappedSpot(page, item.description, spots.description, map.descriptionLineHeight, map.descriptionMaxLines, fonts)
    if (item.unit) drawSpot(page, item.unit, spots.unit, fonts)
    drawSpot(page, String(item.quantity), spots.qty, fonts)
    drawSpot(page, formatAmount(Number(item.unitPrice)), spots.unitPrice, fonts)
    drawSpot(page, formatAmount(Number(item.amount)), spots.amount, fonts)
  }

  const lastPage = pages[pages.length - 1]
  drawSpot(lastPage, formatAmount(Number(invoice.subtotal)), map.subtotal, fonts)
  drawSpot(lastPage, formatAmount(Number(invoice.vatAmount)), map.vat, fonts)
  drawSpot(lastPage, formatAmount(Number(invoice.totalAmount)), map.total, fonts)
  drawSpot(lastPage, `Prepared By: ${preparedByName}`, map.preparedBy, fonts)

  const bytes = await pdf.save()
  return Buffer.from(bytes)
}

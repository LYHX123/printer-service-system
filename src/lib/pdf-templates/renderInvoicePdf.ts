import { format } from "date-fns"
import type { InvoicePdfData } from "@/lib/data/invoices"
import { INVOICE_TEMPLATES, ACTIVE_INVOICE_TEMPLATE_VERSION } from "./invoiceTemplateMap"
import { loadTemplate, drawSpot, drawWrappedSpot, drawFixedSlotLines, drawPublicImage, formatAmount } from "./engine"

export async function renderInvoicePdf(invoice: InvoicePdfData): Promise<Buffer> {
  const map = INVOICE_TEMPLATES[ACTIVE_INVOICE_TEMPLATE_VERSION]
  const { pdf, page, fonts } = await loadTemplate(map.file)

  if (map.logo) await drawPublicImage(pdf, page, invoice.company.logoUrl, map.logo)
  drawSpot(page, invoice.company.name, map.companyName, fonts)
  if (invoice.company.address) drawSpot(page, invoice.company.address, map.companyAddress, fonts)
  if (invoice.company.kraPin) drawSpot(page, `PIN: ${invoice.company.kraPin}`, map.companyPin, fonts)

  drawFixedSlotLines(page, invoice.customer.companyName, map.customerNameLines, fonts, true)
  const customerPin = invoice.customerPin || invoice.customer.pinNumber
  drawSpot(page, `PIN: ${customerPin || "—"}`, map.customerPin, fonts)

  drawSpot(page, format(new Date(invoice.date), "dd MMM yyyy"), map.date, fonts)
  drawSpot(page, invoice.invoiceNumber, map.documentNumber, fonts)

  const rowCount = Math.min(invoice.items.length, map.itemRows.length)
  if (invoice.items.length > map.itemRows.length) {
    console.warn(
      `Invoice ${invoice.invoiceNumber} has ${invoice.items.length} items but template "${map.version}" only has ${map.itemRows.length} row slots — extra items were not printed.`
    )
  }

  for (let i = 0; i < rowCount; i++) {
    const item = invoice.items[i]
    const spots = map.itemRows[i]

    if (item.part?.partNumber) drawSpot(page, item.part.partNumber, spots.itemNo, fonts)
    drawWrappedSpot(page, item.description, spots.description, map.descriptionLineHeight, map.descriptionMaxLines, fonts)
    if (item.unit) drawSpot(page, item.unit, spots.unit, fonts)
    drawSpot(page, String(item.quantity), spots.qty, fonts)
    drawSpot(page, formatAmount(Number(item.unitPrice)), spots.unitPrice, fonts)
    drawSpot(page, formatAmount(Number(item.amount)), spots.amount, fonts)
  }

  drawSpot(page, formatAmount(Number(invoice.subtotal)), map.subtotal, fonts)
  drawSpot(page, formatAmount(Number(invoice.vatAmount)), map.vat, fonts)
  drawSpot(page, formatAmount(Number(invoice.totalAmount)), map.total, fonts)

  const bytes = await pdf.save()
  return Buffer.from(bytes)
}

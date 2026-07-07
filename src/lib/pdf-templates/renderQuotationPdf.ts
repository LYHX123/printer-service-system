import { format } from "date-fns"
import type { QuotationPdfData } from "@/lib/data/quotations"
import { QUOTATION_TEMPLATES, ACTIVE_QUOTATION_TEMPLATE_VERSION } from "./quotationTemplateMap"
import { createDocumentFromTemplate, drawSpot, drawWrappedSpot, drawFixedSlotLines, drawPublicImage, formatAmount } from "./engine"

export async function renderQuotationPdf(quotation: QuotationPdfData, preparedByName: string): Promise<Buffer> {
  const map = QUOTATION_TEMPLATES[ACTIVE_QUOTATION_TEMPLATE_VERSION]
  const rowsPerPage = map.itemRows.length
  const pageCount = Math.max(1, Math.ceil(quotation.items.length / rowsPerPage))
  const { pdf, pages, fonts } = await createDocumentFromTemplate(map.file, pageCount)

  const dateText = format(new Date(quotation.createdAt), "dd MMM yyyy")

  for (const page of pages) {
    drawFixedSlotLines(page, quotation.customer.companyName, map.customerNameLines, fonts, true)
    if (quotation.customer.location) drawWrappedSpot(page, quotation.customer.location, map.customerAddress, 0, 1, fonts)
    drawSpot(page, quotation.customer.pinNumber || "—", map.customerPin, fonts)
    drawSpot(page, dateText, map.date, fonts)
    drawSpot(page, quotation.quotationNumber, map.documentNumber, fonts)
  }

  for (let i = 0; i < quotation.items.length; i++) {
    const item = quotation.items[i]
    const page = pages[Math.floor(i / rowsPerPage)]
    const spots = map.itemRows[i % rowsPerPage]

    if (item.part?.partNumber) drawSpot(page, item.part.partNumber, spots.itemNo, fonts)

    const description = item.part
      ? item.part.brand
        ? `${item.part.brand} — ${item.part.name}`
        : item.part.name
      : (item.description ?? "")
    drawWrappedSpot(page, description, spots.description, map.descriptionLineHeight, map.descriptionMaxLines, fonts)

    if (item.part?.unit) drawSpot(page, item.part.unit, spots.unit, fonts)
    drawSpot(page, String(item.quantity), spots.qty, fonts)
    drawSpot(page, formatAmount(Number(item.unitPrice)), spots.unitPrice, fonts)
    drawSpot(page, formatAmount(Number(item.subtotal)), spots.amount, fonts)

    if (spots.image) await drawPublicImage(pdf, page, item.part?.imageUrl, spots.image)
  }

  const vatPercent = Number(quotation.vatPercent)
  const subtotal = Number(quotation.subtotal)
  const vatAmount = (subtotal * vatPercent) / 100
  const totalCost = Number(quotation.totalCost)

  const lastPage = pages[pages.length - 1]
  drawSpot(lastPage, formatAmount(subtotal), map.subtotal, fonts)
  drawSpot(lastPage, formatAmount(vatAmount), map.vat, fonts)
  drawSpot(lastPage, formatAmount(totalCost), map.total, fonts)
  drawSpot(lastPage, `Prepared By: ${preparedByName}`, map.preparedBy, fonts)

  const bytes = await pdf.save()
  return Buffer.from(bytes)
}

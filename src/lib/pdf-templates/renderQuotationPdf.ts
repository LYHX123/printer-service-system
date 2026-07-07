import { format } from "date-fns"
import type { QuotationPdfData } from "@/lib/data/quotations"
import { QUOTATION_TEMPLATES, ACTIVE_QUOTATION_TEMPLATE_VERSION } from "./quotationTemplateMap"
import { loadTemplate, drawSpot, drawWrappedSpot, drawFixedSlotLines, drawPublicImage, formatAmount } from "./engine"

export async function renderQuotationPdf(quotation: QuotationPdfData): Promise<Buffer> {
  const map = QUOTATION_TEMPLATES[ACTIVE_QUOTATION_TEMPLATE_VERSION]
  const { pdf, page, fonts } = await loadTemplate(map.file)

  if (map.logo) await drawPublicImage(pdf, page, quotation.company.logoUrl, map.logo)
  drawSpot(page, quotation.company.name, map.companyName, fonts)
  if (quotation.company.address) drawSpot(page, quotation.company.address, map.companyAddress, fonts)
  if (quotation.company.kraPin) drawSpot(page, `PIN: ${quotation.company.kraPin}`, map.companyPin, fonts)

  drawFixedSlotLines(page, quotation.customer.companyName, map.customerNameLines, fonts, true)
  drawSpot(page, `PIN: ${quotation.customer.pinNumber || "—"}`, map.customerPin, fonts)

  drawSpot(page, format(new Date(quotation.createdAt), "dd MMM yyyy"), map.date, fonts)
  drawSpot(page, quotation.quotationNumber, map.documentNumber, fonts)

  const rowCount = Math.min(quotation.items.length, map.itemRows.length)
  if (quotation.items.length > map.itemRows.length) {
    console.warn(
      `Quotation ${quotation.quotationNumber} has ${quotation.items.length} items but template "${map.version}" only has ${map.itemRows.length} row slots — extra items were not printed.`
    )
  }

  for (let i = 0; i < rowCount; i++) {
    const item = quotation.items[i]
    const spots = map.itemRows[i]

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

  drawSpot(page, formatAmount(subtotal), map.subtotal, fonts)
  drawSpot(page, formatAmount(vatAmount), map.vat, fonts)
  drawSpot(page, formatAmount(totalCost), map.total, fonts)

  const bytes = await pdf.save()
  return Buffer.from(bytes)
}

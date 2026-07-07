import type { DocumentTemplateMap, ItemRowSpots } from "./types"

// Row center-Y positions measured from templates/quotation/quotation-template.pdf
// (see scripts/inspect-pdf-text.mjs). Rows 1-3 are spaced 57.1pt apart; rows 6-8
// are compressed by the template's original author to keep the whole table on
// one page, so these are literal per-row values, not a computed step.
const ROW_CENTER_Y = [598.7, 541.6, 484.5, 427.4, 370.3, 313.1, 260.6, 213.2]

function buildRows(centerYs: number[]): ItemRowSpots[] {
  return centerYs.map((y) => ({
    itemNo: { x: 78, y, size: 7.5 },
    description: { x: 120, y, size: 7.5, maxWidth: 90 },
    unit: { x: 216, y, size: 7.5 },
    qty: { x: 293, y, size: 7.5 },
    unitPrice: { x: 403, y, size: 7.5, align: "right", boundX: 403 },
    amount: { x: 478, y, size: 7.5, align: "right", boundX: 478 },
    image: { x: 490, y: y - 13, width: 26, height: 26 },
  }))
}

export const quotationTemplateMapV1: DocumentTemplateMap = {
  version: "v1",
  file: "templates/quotation/quotation-template.pdf",
  pageSize: { width: 595, height: 842 },

  logo: { x: 500, y: 780, width: 50, height: 50 },
  companyName: { x: 297.5, y: 771.6, size: 8.2, bold: true, align: "center", boundX: 297.5 },
  companyAddress: { x: 297.5, y: 761.9, size: 8.2, align: "center", boundX: 297.5 },
  companyPin: { x: 297.5, y: 752.2, size: 8.2, align: "center", boundX: 297.5 },

  customerNameLines: [
    { x: 187.7, y: 702.3, size: 7.5, maxWidth: 150 },
    { x: 187.7, y: 693.6, size: 7.5, maxWidth: 150 },
  ],
  customerPin: { x: 187.7, y: 676.3, size: 7.5 },

  date: { x: 362.6, y: 712.5, size: 7.1 },
  documentNumber: { x: 392.7, y: 670.1, size: 7.1 },

  itemRows: buildRows(ROW_CENTER_Y),
  descriptionLineHeight: 8.65,
  descriptionMaxLines: 3,

  subtotal: { x: 478, y: 183.1, size: 7.1, align: "right", boundX: 478 },
  vat: { x: 478, y: 173.4, size: 7.1, align: "right", boundX: 478 },
  total: { x: 478, y: 152.5, size: 7.5, bold: true, align: "right", boundX: 478 },
}

/**
 * Registry of quotation template versions, keyed by `version`. To add a new
 * template revision: drop the new PDF under templates/quotation/, measure its
 * coordinates with `node scripts/inspect-pdf-text.mjs <file>`, add a new
 * versioned map here, and point ACTIVE_QUOTATION_TEMPLATE_VERSION at it (or
 * make the active version a per-company setting later).
 */
export const QUOTATION_TEMPLATES: Record<string, DocumentTemplateMap> = {
  v1: quotationTemplateMapV1,
}

export const ACTIVE_QUOTATION_TEMPLATE_VERSION = "v1"

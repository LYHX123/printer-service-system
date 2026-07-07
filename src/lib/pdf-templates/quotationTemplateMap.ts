import type { DocumentTemplateMap, ItemRowSpots } from "./types"

// Row center-Y positions measured from templates/quotation/quotation-template.pdf
// (see scripts/inspect-pdf-text.mjs). Evenly spaced ~55pt apart; reused as-is
// on every continuation page since each page is a fresh copy of the template.
const ROW_CENTER_Y = [605.7, 550.8, 495.8, 440.8, 385.9, 330.9, 276.0, 221.0]

function buildRows(centerYs: number[]): ItemRowSpots[] {
  return centerYs.map((y) => ({
    itemNo: { x: 78, y, size: 7.5 },
    description: { x: 118, y, size: 7.5, maxWidth: 90 },
    unit: { x: 213, y, size: 7.5 },
    qty: { x: 289, y, size: 7.5 },
    unitPrice: { x: 398, y, size: 7.5, align: "right", boundX: 398 },
    amount: { x: 472, y, size: 7.5, align: "right", boundX: 472 },
    image: { x: 483, y: y - 13, width: 26, height: 26 },
  }))
}

export const quotationTemplateMapV1: DocumentTemplateMap = {
  version: "v1",
  file: "templates/quotation/quotation-template.pdf",
  pageSize: { width: 595.2, height: 842 },

  customerNameLines: [
    { x: 185.3, y: 712.4, size: 7.3, maxWidth: 150 },
    { x: 185.3, y: 703.4, size: 7.3, maxWidth: 150 },
  ],
  customerAddress: { x: 185.3, y: 694.4, size: 6.8, maxWidth: 150 },
  // "PIN:" label is static template art at (185.3, 684.9); value is drawn right after it.
  customerPin: { x: 205, y: 684.9, size: 7.3 },

  // "Date:" / "Quotation No.:" labels are static; values sit inline after them,
  // offset by the label's approximate printed width.
  date: { x: 357.2, y: 714.8, size: 7.3 },
  documentNumber: { x: 387.3, y: 674.2, size: 7.3 },
  // No template slot for this field — placed inside the NOTE box, below the
  // static validity line, since that's the nearest free space still within
  // the document's bordered frame.
  preparedBy: { x: 51.8, y: 163, size: 7 },

  itemRows: buildRows(ROW_CENTER_Y),
  descriptionLineHeight: 8.65,
  descriptionMaxLines: 3,

  subtotal: { x: 462, y: 187.5, size: 7.3, align: "right", boundX: 462 },
  vat: { x: 462, y: 177.9, size: 7.3, align: "right", boundX: 462 },
  total: { x: 462, y: 157.3, size: 7.5, bold: true, align: "right", boundX: 462 },
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

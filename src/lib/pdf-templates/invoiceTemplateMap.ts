import type { DocumentTemplateMap, ItemRowSpots } from "./types"

// Row center-Y positions measured from templates/invoice/invoice-template.pdf
// (see scripts/inspect-pdf-text.mjs). Unlike the quotation template, these 8
// rows are evenly spaced (~45.5pt apart).
const ROW_CENTER_Y = [565.0, 519.6, 474.1, 428.6, 383.1, 337.6, 292.2, 246.7]

function buildRows(centerYs: number[]): ItemRowSpots[] {
  return centerYs.map((y) => ({
    itemNo: { x: 80, y, size: 8 },
    description: { x: 145, y, size: 8, maxWidth: 92 },
    unit: { x: 242, y, size: 8 },
    qty: { x: 338, y, size: 8 },
    unitPrice: { x: 468, y, size: 8, align: "right", boundX: 468 },
    amount: { x: 541, y, size: 8, align: "right", boundX: 541 },
  }))
}

export const invoiceTemplateMapV1: DocumentTemplateMap = {
  version: "v1",
  file: "templates/invoice/invoice-template.pdf",
  pageSize: { width: 595.2, height: 842 },

  logo: { x: 500, y: 786, width: 55, height: 55 },
  companyName: { x: 297.6, y: 777.0, size: 11.5, bold: true, align: "center", boundX: 297.6 },
  companyAddress: { x: 297.6, y: 762.8, size: 11.5, align: "center", boundX: 297.6 },
  companyPin: { x: 297.6, y: 748.6, size: 11.5, align: "center", boundX: 297.6 },

  customerNameLines: [
    { x: 207.7, y: 683.2, size: 9, maxWidth: 180 },
    { x: 207.7, y: 672.1, size: 9, maxWidth: 180 },
    { x: 207.7, y: 660.9, size: 9, maxWidth: 180 },
  ],
  customerPin: { x: 207.7, y: 638.6, size: 9 },

  date: { x: 420.6, y: 697.3, size: 9 },
  documentNumber: { x: 397.4, y: 641.1, size: 9 },

  itemRows: buildRows(ROW_CENTER_Y),
  descriptionLineHeight: 11.15,
  descriptionMaxLines: 2,

  subtotal: { x: 541, y: 216.4, size: 9, align: "right", boundX: 541 },
  vat: { x: 541, y: 204.6, size: 9, align: "right", boundX: 541 },
  total: { x: 541, y: 183.2, size: 9.5, bold: true, align: "right", boundX: 541 },
}

/**
 * Registry of invoice template versions, keyed by `version`. To add a new
 * template revision: drop the new PDF under templates/invoice/, measure its
 * coordinates with `node scripts/inspect-pdf-text.mjs <file>`, add a new
 * versioned map here, and point ACTIVE_INVOICE_TEMPLATE_VERSION at it.
 */
export const INVOICE_TEMPLATES: Record<string, DocumentTemplateMap> = {
  v1: invoiceTemplateMapV1,
}

export const ACTIVE_INVOICE_TEMPLATE_VERSION = "v1"

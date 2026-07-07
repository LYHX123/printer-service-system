export type TextAlign = "left" | "right" | "center"

export interface TextSpot {
  x: number
  y: number
  size: number
  bold?: boolean
  align?: TextAlign
  /** Right edge (align "right") or center point (align "center") to measure text width against. Required unless align is "left". */
  boundX?: number
}

export interface ItemRowSpots {
  itemNo: TextSpot
  description: TextSpot & { maxWidth: number }
  unit: TextSpot
  qty: TextSpot
  unitPrice: TextSpot
  amount: TextSpot
  image?: { x: number; y: number; width: number; height: number }
}

/**
 * Coordinate map for one pre-printed PDF template. All coordinates are PDF
 * points with the origin at the page's bottom-left, matching pdf-lib's
 * coordinate system. The company letterhead (name/address/PIN/logo) and
 * document title are static artwork baked into the template itself and are
 * never redrawn — only the fields below are dynamic.
 *
 * A new template file (redesigned layout, different page size, etc.) gets
 * its own map object with a bumped `version` rather than mutating this one,
 * so old and new can be registered side by side.
 */
export interface DocumentTemplateMap {
  version: string
  /** Path relative to the project root, e.g. "templates/quotation/quotation-template.pdf". */
  file: string
  pageSize: { width: number; height: number }

  /** Fixed Y per line slot the template reserves for the customer name; extra text beyond this many lines is truncated. */
  customerNameLines: Array<{ x: number; y: number; size: number; maxWidth: number }>
  /** Single line below the name slots — the template has no dedicated label for this. */
  customerAddress: TextSpot & { maxWidth: number }
  customerPin: TextSpot

  date: TextSpot
  documentNumber: TextSpot
  /** No dedicated template slot for this field; placed in the nearest sensible free space. */
  preparedBy: TextSpot

  /** One page's worth of row slots; reused identically on every continuation page. */
  itemRows: ItemRowSpots[]
  descriptionLineHeight: number
  descriptionMaxLines: number

  subtotal: TextSpot
  vat: TextSpot
  total: TextSpot
}

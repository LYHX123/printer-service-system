import path from "path"
import type { TemplateType } from "./types"

export interface TemplateItemColumns {
  no: number
  itemName: number
  description: number
  unit: number
  qty: number
  unitPrice: number
  amount: number
}

export interface TemplateTypeConfig {
  /** Path to the source .xlsx template, relative to the project root. */
  templatePath: string
  /** Worksheet index to operate on (0-based). */
  sheetIndex: number
  /** First and last row (1-based) of the pre-built item rows in the template. */
  itemsFirstRow: number
  itemsLastRow: number
  itemColumns: TemplateItemColumns
  /** Row offsets (relative to the last item row) where footer totals live. */
  footer: {
    subtotalRowOffset: number
    vatRowOffset: number
    grandTotalRowOffset: number
  }
}

const ITEM_COLUMNS: TemplateItemColumns = {
  no: 1,
  itemName: 2,
  description: 3,
  unit: 4,
  qty: 5,
  unitPrice: 6,
  amount: 7,
}

const FOOTER_OFFSETS = {
  subtotalRowOffset: 1,
  vatRowOffset: 2,
  grandTotalRowOffset: 3,
}

// New document types can be added here without touching engine logic.
export const TEMPLATE_CONFIG: Record<TemplateType, TemplateTypeConfig> = {
  quotation: {
    templatePath: path.join("templates", "quotation", "quotation template.xlsx"),
    sheetIndex: 0,
    itemsFirstRow: 7,
    itemsLastRow: 16,
    itemColumns: ITEM_COLUMNS,
    footer: FOOTER_OFFSETS,
  },
  invoice: {
    templatePath: path.join("templates", "invoice", "invoice template.xlsx"),
    sheetIndex: 0,
    itemsFirstRow: 7,
    itemsLastRow: 14,
    itemColumns: ITEM_COLUMNS,
    footer: FOOTER_OFFSETS,
  },
}

export const OUTPUT_ROOT = path.join(process.cwd(), "storage", "generated")

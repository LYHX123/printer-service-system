export type TemplateType = "quotation" | "invoice"

export type TemplateData = Record<string, string | number | Date | null | undefined>

export interface TemplateItem {
  itemName?: string | null
  description?: string | null
  unit?: string | null
  qty: number
  unitPrice: number
}

export interface GenerateExcelData {
  items?: TemplateItem[]
  [key: string]: string | number | Date | TemplateItem[] | null | undefined
}

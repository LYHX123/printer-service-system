import { ExcelTemplateError } from "@/lib/excelTemplate"

export class InvoiceExcelError extends ExcelTemplateError {
  constructor(message: string) {
    super(message)
    this.name = "InvoiceExcelError"
  }
}

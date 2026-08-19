import { ExcelTemplateError } from "@/lib/excelTemplate"

export class DeliveryExcelError extends ExcelTemplateError {
  constructor(message: string) {
    super(message)
    this.name = "DeliveryExcelError"
  }
}

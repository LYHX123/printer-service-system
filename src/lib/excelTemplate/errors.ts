/** Base error for the placeholder-driven Excel engines (quotationExcel, invoiceExcel). */
export class ExcelTemplateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ExcelTemplateError"
  }
}

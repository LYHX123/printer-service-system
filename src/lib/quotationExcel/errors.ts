export class QuotationExcelError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "QuotationExcelError"
  }
}

export class TemplateEngineError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "TemplateEngineError"
  }
}

import { existsSync, readFileSync } from "fs"
import path from "path"
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib"
import type { TextSpot } from "./types"

const TEXT_COLOR = rgb(0.12, 0.16, 0.22)

export interface TemplateFonts {
  regular: PDFFont
  bold: PDFFont
}

/**
 * Builds a fresh output document with `pageCount` copies of the template's
 * first page — one per page of line items — so any number of items can be
 * rendered by paginating rather than being capped at the template's fixed
 * row count.
 */
export async function createDocumentFromTemplate(
  relativePath: string,
  pageCount: number
): Promise<{ pdf: PDFDocument; pages: PDFPage[]; fonts: TemplateFonts }> {
  const filePath = path.join(process.cwd(), relativePath)
  const bytes = readFileSync(filePath)
  const templateDoc = await PDFDocument.load(bytes)

  const pdf = await PDFDocument.create()
  const pages: PDFPage[] = []
  for (let i = 0; i < Math.max(1, pageCount); i++) {
    const [copied] = await pdf.copyPages(templateDoc, [0])
    pdf.addPage(copied)
    pages.push(copied)
  }

  const [regular, bold] = await Promise.all([
    pdf.embedFont(StandardFonts.TimesRoman),
    pdf.embedFont(StandardFonts.TimesRomanBold),
  ])
  return { pdf, pages, fonts: { regular, bold } }
}

/** Draws a single line of text at a spot, resolving right/center alignment against `boundX`. */
export function drawSpot(page: PDFPage, text: string, spot: TextSpot, fonts: TemplateFonts) {
  if (!text) return
  const font = spot.bold ? fonts.bold : fonts.regular
  const width = font.widthOfTextAtSize(text, spot.size)
  let x = spot.x
  if (spot.align === "right" && spot.boundX !== undefined) x = spot.boundX - width
  else if (spot.align === "center" && spot.boundX !== undefined) x = spot.boundX - width / 2
  page.drawText(text, { x, y: spot.y, size: spot.size, font, color: TEXT_COLOR })
}

/** Greedy word-wrap of `text` into at most `maxLines` lines no wider than `maxWidth`; overflow is truncated onto the last line with an ellipsis. */
export function wrapText(text: string, maxWidth: number, maxLines: number, size: number, font: PDFFont): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []

  const lines: string[] = []
  let current = ""
  let consumed = 0
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) {
      current = candidate
      consumed++
    } else {
      lines.push(current)
      if (lines.length === maxLines) break
      current = word
      consumed++
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current)
  }

  if (consumed < words.length && lines.length === maxLines) {
    let lastLine = lines[maxLines - 1]
    while (font.widthOfTextAtSize(`${lastLine}…`, size) > maxWidth && lastLine.length > 1) {
      lastLine = lastLine.slice(0, -1)
    }
    lines[maxLines - 1] = `${lastLine}…`
  }
  return lines
}

/** Draws text wrapped to fit `maxWidth`/`maxLines`, vertically centered on `spot.y`. */
export function drawWrappedSpot(
  page: PDFPage,
  text: string,
  spot: TextSpot & { maxWidth: number },
  lineHeight: number,
  maxLines: number,
  fonts: TemplateFonts
) {
  if (!text) return
  const font = spot.bold ? fonts.bold : fonts.regular
  const lines = wrapText(text, spot.maxWidth, maxLines, spot.size, font)
  const n = lines.length
  lines.forEach((line, i) => {
    const y = spot.y + ((n - 1) / 2 - i) * lineHeight
    drawSpot(page, line, { ...spot, y }, fonts)
  })
}

/** Draws up to `slots.length` lines top-anchored at fixed per-line positions; extra lines beyond the slot count are dropped into the last slot with an ellipsis. */
export function drawFixedSlotLines(
  page: PDFPage,
  text: string,
  slots: Array<{ x: number; y: number; size: number; maxWidth: number }>,
  fonts: TemplateFonts,
  bold = false
) {
  if (!text || slots.length === 0) return
  const font = bold ? fonts.bold : fonts.regular
  const lines = wrapText(text, slots[0].maxWidth, slots.length, slots[0].size, font)
  lines.forEach((line, i) => {
    const slot = slots[i]
    drawSpot(page, line, { x: slot.x, y: slot.y, size: slot.size, bold }, fonts)
  })
}

export async function drawPublicImage(
  pdf: PDFDocument,
  page: PDFPage,
  url: string | null | undefined,
  box: { x: number; y: number; width: number; height: number }
) {
  const resolved = resolvePublicFileBytes(url)
  if (!resolved) return
  try {
    const image = resolved.ext === ".png" ? await pdf.embedPng(resolved.bytes) : await pdf.embedJpg(resolved.bytes)
    const scale = Math.min(box.width / image.width, box.height / image.height)
    const width = image.width * scale
    const height = image.height * scale
    page.drawImage(image, {
      x: box.x + (box.width - width) / 2,
      y: box.y + (box.height - height) / 2,
      width,
      height,
    })
  } catch {
    // Corrupt or unsupported image — skip rather than fail the whole PDF.
  }
}

function resolvePublicFileBytes(url: string | null | undefined): { bytes: Buffer; ext: string } | null {
  if (!url) return null
  const filePath = path.join(process.cwd(), "public", url.replace(/^\//, ""))
  if (!existsSync(filePath)) return null
  const ext = path.extname(filePath).toLowerCase()
  if (ext !== ".png" && ext !== ".jpg" && ext !== ".jpeg") return null
  return { bytes: readFileSync(filePath), ext }
}

export function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

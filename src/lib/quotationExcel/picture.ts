import { readFile } from "fs/promises"
import path from "path"
import sharp from "sharp"
import type ExcelJS from "exceljs"

export interface LoadedImage {
  buffer: Buffer
  width: number
  height: number
}

/**
 * Loads a product picture from /public and normalizes it to JPEG in memory.
 * Runs every source image (JPG/PNG/WEBP/whatever) through sharp so ExcelJS
 * — which only embeds JPEG/PNG/GIF — always gets a format it accepts.
 * Returns null (never throws) on any failure: a missing file, a corrupt
 * image, or an unreadable format must never fail the whole Quotation
 * export — the SAMPLE cell is just left empty for that one row.
 */
export async function loadProductImage(publicUrl: string): Promise<LoadedImage | null> {
  try {
    const filePath = path.join(process.cwd(), "public", publicUrl.replace(/^\//, ""))
    const raw = await readFile(filePath)
    const normalized = await sharp(raw).rotate().jpeg({ quality: 90 }).toBuffer()
    const meta = await sharp(normalized).metadata()
    if (!meta.width || !meta.height) return null
    return { buffer: normalized, width: meta.width, height: meta.height }
  } catch (error) {
    console.warn(`[quotationExcel] Skipped picture "${publicUrl}":`, error)
    return null
  }
}

function colWidthToPixels(width: number): number {
  return Math.round(width * 7 + 5)
}

function rowHeightToPixels(points: number): number {
  return Math.round(points * (96 / 72))
}

/** Fraction of the cell's width/height the picture is allowed to occupy — the rest is centering margin. */
const CELL_FILL_FACTOR = 0.85
/**
 * How far a small source image may be scaled up to fill more of the cell.
 * High on purpose ("尽可能利用 SAMPLE 单元格可用空间" — use as much of the
 * available cell space as possible) — SparePart photos are already capped
 * at 600x600 on upload, so there's no real risk of blowing up a tiny icon.
 */
const MAX_UPSCALE = 8

const EMU_PER_PIXEL = 9525

/**
 * Embeds an already-loaded image into a single cell, centered both
 * horizontally and vertically, scaled (preserving aspect ratio, never
 * cropped) to use as much of the cell's actual pixel area as possible —
 * derived from the template's real column width and the row's final
 * uniform height — up to a ~85% fill factor so the picture never touches
 * the cell border.
 *
 * Anchored via raw nativeCol/nativeColOff/nativeRow/nativeRowOff (true EMU
 * offsets) rather than ExcelJS's fractional {col, row} anchor API. That
 * fractional API turned out to be unusable for this: ExcelJS's own Anchor
 * class (node_modules/exceljs/lib/doc/anchor.js) converts a fraction to an
 * offset as `frac * Math.floor(columnWidthChars * 10000)`, then writes that
 * number straight into <xdr:colOff> with no further conversion — even
 * though the OOXML spec defines that field in EMU (a char-width column is
 * really ~66,675 EMU wide, not 10,000). The result, verified by inspecting
 * a generated file's raw drawing XML: any single-column fractional anchor
 * on this template's SAMPLE column tops out at roughly 27px of true
 * rendered width — far too small — and reaching for more width just spills
 * the anchor into neighboring columns instead. Passing nativeCol/nativeColOff
 * directly bypasses that conversion entirely: those fields are written to
 * the XML as-is, so setting them to real EMU values places the image
 * exactly where intended.
 */
export function insertProductPicture(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  colNumber: number,
  image: LoadedImage,
  rowHeightPt: number
): void {
  const imageId = workbook.addImage({ buffer: image.buffer as unknown as ExcelJS.Buffer, extension: "jpeg" })

  const column = sheet.getColumn(colNumber)
  const colWidthPx = colWidthToPixels(typeof column.width === "number" ? column.width : 10)
  const rowHeightPx = rowHeightToPixels(rowHeightPt)

  const availableWidthPx = colWidthPx * CELL_FILL_FACTOR
  const availableHeightPx = rowHeightPx * CELL_FILL_FACTOR

  const scale = Math.min(availableWidthPx / image.width, availableHeightPx / image.height, MAX_UPSCALE)
  const drawWidthPx = image.width * scale
  const drawHeightPx = image.height * scale

  const offsetXPx = Math.max(0, (colWidthPx - drawWidthPx) / 2)
  const offsetYPx = Math.max(0, (rowHeightPx - drawHeightPx) / 2)

  const nativeCol = colNumber - 1
  const nativeRow = rowNumber - 1

  sheet.addImage(imageId, {
    tl: {
      nativeCol,
      nativeColOff: Math.round(offsetXPx * EMU_PER_PIXEL),
      nativeRow,
      nativeRowOff: Math.round(offsetYPx * EMU_PER_PIXEL),
    },
    br: {
      nativeCol,
      nativeColOff: Math.round((offsetXPx + drawWidthPx) * EMU_PER_PIXEL),
      nativeRow,
      nativeRowOff: Math.round((offsetYPx + drawHeightPx) * EMU_PER_PIXEL),
    },
  } as unknown as ExcelJS.ImageRange)
}

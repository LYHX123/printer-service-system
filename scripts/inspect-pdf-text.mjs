// Dev tool: dumps every text run in a PDF with its page size and (x, y) position
// in PDF points (origin bottom-left), for calibrating template coordinate maps.
// Usage: node scripts/inspect-pdf-text.mjs <path-to-pdf>
import { readFile } from "node:fs/promises"

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")

const filePath = process.argv[2]
if (!filePath) {
  console.error("Usage: node scripts/inspect-pdf-text.mjs <path-to-pdf>")
  process.exit(1)
}

const data = new Uint8Array(await readFile(filePath))
const doc = await pdfjs.getDocument({ data }).promise

for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
  const page = await doc.getPage(pageNum)
  const viewport = page.getViewport({ scale: 1 })
  console.log(`\n=== Page ${pageNum}: ${viewport.width.toFixed(1)} x ${viewport.height.toFixed(1)} pt ===`)

  const content = await page.getTextContent()
  for (const item of content.items) {
    if (!item.str.trim()) continue
    const [a, b, c, d, x, y] = item.transform
    console.log(
      `x=${x.toFixed(1)} y=${y.toFixed(1)} size=${Math.hypot(a, b).toFixed(1)} "${item.str}"`
    )
  }
}

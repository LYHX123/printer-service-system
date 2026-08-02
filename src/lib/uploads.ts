import { mkdir, writeFile, unlink, readFile } from "fs/promises"
import path from "path"
import { randomUUID } from "crypto"
import sharp from "sharp"

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads")

export async function saveJobPhoto(
  jobId: string,
  buffer: Buffer
): Promise<{ fileUrl: string; fileName: string; sizeBytes: number; mimeType: string }> {
  const dir = path.join(UPLOADS_ROOT, "jobs", jobId, "photos")
  await mkdir(dir, { recursive: true })

  const fileName = `${randomUUID()}.jpg`
  const resized = await sharp(buffer)
    .rotate()
    .resize({ width: 1200, withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()

  await writeFile(path.join(dir, fileName), resized)

  return {
    fileUrl: `/uploads/jobs/${jobId}/photos/${fileName}`,
    fileName,
    sizeBytes: resized.length,
    mimeType: "image/jpeg",
  }
}

export async function saveCompanyLogo(
  companyId: string,
  buffer: Buffer
): Promise<string> {
  const dir = path.join(UPLOADS_ROOT, "companies", companyId)
  await mkdir(dir, { recursive: true })

  const fileName = "logo.png"
  const resized = await sharp(buffer)
    .rotate()
    .resize({ width: 400, height: 400, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer()

  await writeFile(path.join(dir, fileName), resized)

  return `/uploads/companies/${companyId}/${fileName}`
}

export async function saveSparePartImage(
  partId: string,
  buffer: Buffer
): Promise<string> {
  const dir = path.join(UPLOADS_ROOT, "spareparts", partId)
  await mkdir(dir, { recursive: true })

  const fileName = "image.jpg"
  const resized = await sharp(buffer)
    .rotate()
    .resize({ width: 600, height: 600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()

  await writeFile(path.join(dir, fileName), resized)

  return `/uploads/spareparts/${partId}/${fileName}`
}

/**
 * Copies a SparePart's current picture into its own immutable file, owned by
 * a specific QuotationItem, at quotation-save time. A plain URL-string
 * snapshot would not be enough here: saveSparePartImage() always writes to
 * the same fixed "image.jpg" path per part, so a later re-upload would
 * silently change what a stored URL points to. Copying the bytes into a
 * dedicated path keyed by quotationItemId is what actually makes the
 * snapshot immutable. Returns null (never throws) if the source image is
 * missing on disk — callers should just leave pictureSnapshot unset and let
 * the live-SparePart fallback apply at export time.
 */
export async function saveQuotationItemPictureSnapshot(
  quotationItemId: string,
  sourceImageUrl: string
): Promise<string | null> {
  const sourcePath = path.join(process.cwd(), "public", sourceImageUrl.replace(/^\//, ""))

  let buffer: Buffer
  try {
    buffer = await readFile(sourcePath)
  } catch {
    return null
  }

  const dir = path.join(UPLOADS_ROOT, "quotations", "items", quotationItemId)
  await mkdir(dir, { recursive: true })

  const fileName = "picture.jpg"
  const resized = await sharp(buffer)
    .rotate()
    .resize({ width: 600, height: 600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()

  await writeFile(path.join(dir, fileName), resized)

  return `/uploads/quotations/items/${quotationItemId}/${fileName}`
}

export async function deleteJobPhoto(fileUrl: string): Promise<void> {
  const filePath = path.join(process.cwd(), "public", fileUrl.replace(/^\//, ""))
  await unlink(filePath).catch(() => {})
}

export async function deleteSparePartImage(fileUrl: string): Promise<void> {
  const filePath = path.join(process.cwd(), "public", fileUrl.replace(/^\//, ""))
  await unlink(filePath).catch(() => {})
}

export async function deleteShopAccountAttachment(fileUrl: string): Promise<void> {
  const filePath = path.join(process.cwd(), "public", fileUrl.replace(/^\//, ""))
  await unlink(filePath).catch(() => {})
}

export async function saveTaskStepImage(
  stepId: string,
  buffer: Buffer
): Promise<{ fileUrl: string; fileName: string }> {
  const dir = path.join(UPLOADS_ROOT, "tasks", "steps", stepId)
  await mkdir(dir, { recursive: true })

  const fileName = `${randomUUID()}.jpg`
  const resized = await sharp(buffer)
    .rotate()
    .resize({ width: 1200, withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()

  await writeFile(path.join(dir, fileName), resized)

  return {
    fileUrl: `/uploads/tasks/steps/${stepId}/${fileName}`,
    fileName,
  }
}

export async function deleteTaskStepImage(fileUrl: string): Promise<void> {
  const filePath = path.join(process.cwd(), "public", fileUrl.replace(/^\//, ""))
  await unlink(filePath).catch(() => {})
}

export async function saveJobSignature(jobId: string, dataUrl: string): Promise<string> {
  const dir = path.join(UPLOADS_ROOT, "jobs", jobId, "signature")
  await mkdir(dir, { recursive: true })

  const match = dataUrl.match(/^data:image\/png;base64,(.+)$/)
  if (!match) throw new Error("Invalid signature data")

  const buffer = Buffer.from(match[1], "base64")
  const fileName = "signature.png"
  await writeFile(path.join(dir, fileName), buffer)

  return `/uploads/jobs/${jobId}/signature/${fileName}`
}

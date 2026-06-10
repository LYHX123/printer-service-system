import { mkdir, writeFile, unlink } from "fs/promises"
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

export async function deleteJobPhoto(fileUrl: string): Promise<void> {
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

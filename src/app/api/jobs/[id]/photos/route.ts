import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { saveJobPhoto } from "@/lib/uploads"
import { canUploadJobMedia } from "@/lib/permissions"
import { ALLOWED_IMAGE_TYPES, MAX_PHOTO_SIZE } from "@/lib/constants"
import type { Role } from "@/types"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canUploadJobMedia(session.user.role as Role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const companyId = session.user.companyId as string
  const { id: jobId } = await params

  const job = await prisma.serviceJob.findFirst({
    where: { id: jobId, companyId },
    select: { id: true },
  })
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }

  const formData = await request.formData()
  const file = formData.get("file")
  const photoType = formData.get("photoType")
  const caption = formData.get("caption")

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }
  if (photoType !== "BEFORE" && photoType !== "AFTER") {
    return NextResponse.json({ error: "Invalid photo type" }, { status: 400 })
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Only JPG, PNG, and WEBP images are allowed" }, { status: 400 })
  }
  if (file.size > MAX_PHOTO_SIZE) {
    return NextResponse.json({ error: "File exceeds 5MB limit" }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const saved = await saveJobPhoto(jobId, buffer)

  const photo = await prisma.jobPhoto.create({
    data: {
      jobId,
      photoType,
      fileUrl: saved.fileUrl,
      fileName: saved.fileName,
      mimeType: saved.mimeType,
      sizeBytes: saved.sizeBytes,
      caption: typeof caption === "string" && caption ? caption : null,
      uploadedById: session.user.id as string,
    },
    include: { uploadedBy: { select: { id: true, name: true } } },
  })

  revalidatePath(`/jobs/${jobId}/photos`)
  revalidatePath(`/jobs/${jobId}`)

  return NextResponse.json({ photo })
}

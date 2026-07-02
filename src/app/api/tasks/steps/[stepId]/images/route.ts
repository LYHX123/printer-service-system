import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTaskStepForAuth } from "@/lib/data/tasks"
import { canUploadTaskStepImage } from "@/lib/permissions"
import { saveTaskStepImage } from "@/lib/uploads"
import { ALLOWED_IMAGE_TYPES, MAX_PHOTO_SIZE } from "@/lib/constants"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ stepId: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string
  const { stepId } = await params

  const step = await getTaskStepForAuth(stepId, companyId)
  if (!step) {
    return NextResponse.json({ error: "Task step not found" }, { status: 404 })
  }
  if (!canUploadTaskStepImage(userId, step.task)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get("file")

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Only JPG, PNG, and WEBP images are allowed" }, { status: 400 })
  }
  if (file.size > MAX_PHOTO_SIZE) {
    return NextResponse.json({ error: "File exceeds 5MB limit" }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const saved = await saveTaskStepImage(stepId, buffer)

  const image = await prisma.taskStepImage.create({
    data: {
      stepId,
      url: saved.fileUrl,
      filename: saved.fileName,
      uploadedById: userId,
    },
    include: { uploadedBy: { select: { id: true, name: true } } },
  })

  revalidatePath("/tasks")

  return NextResponse.json({ image })
}

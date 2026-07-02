import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTaskStepForAuth } from "@/lib/data/tasks"
import { canDeleteTaskStepImage } from "@/lib/permissions"
import { deleteTaskStepImage } from "@/lib/uploads"
import type { Role } from "@/types"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ stepId: string; imageId: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const role = session.user.role as Role
  const companyId = session.user.companyId as string
  const userId = session.user.id as string
  const { stepId, imageId } = await params

  const step = await getTaskStepForAuth(stepId, companyId)
  if (!step) {
    return NextResponse.json({ error: "Task step not found" }, { status: 404 })
  }
  if (!canDeleteTaskStepImage(role, userId, step.task)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const image = await prisma.taskStepImage.findFirst({ where: { id: imageId, stepId } })
  if (!image) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 })
  }

  await deleteTaskStepImage(image.url)
  await prisma.taskStepImage.delete({ where: { id: imageId } })

  revalidatePath("/tasks")

  return NextResponse.json({ success: true })
}

import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { deleteJobPhoto } from "@/lib/uploads"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const role = session.user.role as string
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const companyId = session.user.companyId as string
  const { id: jobId, photoId } = await params

  const photo = await prisma.jobPhoto.findFirst({
    where: { id: photoId, jobId, job: { companyId } },
  })
  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 })
  }

  await deleteJobPhoto(photo.fileUrl)
  await prisma.jobPhoto.delete({ where: { id: photoId } })

  revalidatePath(`/jobs/${jobId}/photos`)
  revalidatePath(`/jobs/${jobId}`)

  return NextResponse.json({ success: true })
}

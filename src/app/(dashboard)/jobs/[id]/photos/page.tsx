import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { getJob } from "@/lib/data/jobs"
import { PageHeader } from "@/components/ui/page-header"
import { PhotoSection } from "@/components/jobs/PhotoSection"

export default async function JobPhotosPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  const { id } = await params
  const companyId = session!.user.companyId as string
  const userRole = session!.user.role as string

  const job = await getJob(id, companyId)
  if (!job) notFound()

  const canDelete = ["ADMIN", "MANAGER"].includes(userRole)
  const beforePhotos = job.photos.filter((p) => p.photoType === "BEFORE")
  const afterPhotos = job.photos.filter((p) => p.photoType === "AFTER")

  return (
    <div>
      <Link href={`/jobs/${id}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft className="h-4 w-4" />
        {job.jobNumber}
      </Link>

      <PageHeader title="Job Photos" subtitle={job.jobNumber} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PhotoSection jobId={id} photoType="BEFORE" title="Before" photos={beforePhotos} canDelete={canDelete} />
        <PhotoSection jobId={id} photoType="AFTER" title="After" photos={afterPhotos} canDelete={canDelete} />
      </div>
    </div>
  )
}

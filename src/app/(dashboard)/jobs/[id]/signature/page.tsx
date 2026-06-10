import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { format } from "date-fns"
import { auth } from "@/lib/auth"
import { getJob } from "@/lib/data/jobs"
import { PageHeader } from "@/components/ui/page-header"
import { SignatureCapture } from "@/components/jobs/SignatureCapture"

export default async function JobSignaturePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  const { id } = await params
  const companyId = session!.user.companyId as string

  const job = await getJob(id, companyId)
  if (!job) notFound()

  return (
    <div>
      <Link href={`/jobs/${id}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft className="h-4 w-4" />
        {job.jobNumber}
      </Link>

      <PageHeader title="Customer Signature" subtitle={job.jobNumber} />

      <div className="max-w-xl rounded-xl border border-slate-200 bg-white p-5">
        {job.signatureUrl ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              Signature captured on{" "}
              <span className="font-medium text-slate-900">
                {job.signedAt ? format(new Date(job.signedAt), "dd MMM yyyy, HH:mm") : "—"}
              </span>
            </p>
            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-4">
              <img src={job.signatureUrl} alt="Customer signature" className="mx-auto max-h-48" />
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-500 mb-4">
              Ask the customer to sign below to confirm collection of their device.
            </p>
            <SignatureCapture jobId={id} />
          </>
        )}
      </div>
    </div>
  )
}

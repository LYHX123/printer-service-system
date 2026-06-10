import { NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"
import { auth } from "@/lib/auth"
import { getJobForReport } from "@/lib/data/reports"
import { RepairReportDocument } from "@/components/pdf/RepairReportDocument"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const companyId = session.user.companyId as string
  const { id } = await params

  const job = await getJobForReport(id, companyId)
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }

  const buffer = await renderToBuffer(<RepairReportDocument job={job} />)
  const fileName = `${job.customer.code}-${job.jobNumber}-${job.equipment.type}-Report.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  })
}

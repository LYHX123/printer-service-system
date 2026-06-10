"use client"

import { Printer, Download } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ReportActionsProps {
  jobId: string
}

export function ReportActions({ jobId }: ReportActionsProps) {
  return (
    <div className="flex gap-2 print:hidden">
      <Button variant="outline" size="sm" icon={<Printer className="h-3.5 w-3.5" />} onClick={() => window.print()}>
        Print
      </Button>
      <a href={`/api/jobs/${jobId}/report/pdf`} target="_blank" rel="noopener noreferrer">
        <Button size="sm" icon={<Download className="h-3.5 w-3.5" />}>
          Download PDF
        </Button>
      </a>
    </div>
  )
}

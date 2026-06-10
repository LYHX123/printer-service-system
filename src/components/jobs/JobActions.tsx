"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { StatusUpdateModal } from "@/components/jobs/StatusUpdateModal"
import { AssignEngineerModal } from "@/components/jobs/AssignEngineerModal"
import { JOB_STATUS_TRANSITIONS } from "@/types"
import type { JobStatus, Role, User } from "@/types"
import { ArrowRight, UserCog } from "lucide-react"

interface JobActionsProps {
  jobId: string
  currentStatus: JobStatus
  currentAssigneeId: string
  engineers: Pick<User, "id" | "name" | "email" | "role">[]
  canUpdateStatus: boolean
  canAssign: boolean
}

export function JobActions({
  jobId,
  currentStatus,
  currentAssigneeId,
  engineers,
  canUpdateStatus,
  canAssign,
}: JobActionsProps) {
  const [statusOpen, setStatusOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)

  const hasNextStatuses = (JOB_STATUS_TRANSITIONS[currentStatus] ?? []).length > 0

  return (
    <>
      <div className="flex gap-2">
        {canAssign && (
          <Button
            variant="outline"
            size="sm"
            icon={<UserCog className="h-3.5 w-3.5" />}
            onClick={() => setAssignOpen(true)}
          >
            Reassign
          </Button>
        )}
        {canUpdateStatus && hasNextStatuses && (
          <Button
            size="sm"
            icon={<ArrowRight className="h-3.5 w-3.5" />}
            onClick={() => setStatusOpen(true)}
          >
            Update Status
          </Button>
        )}
      </div>

      <StatusUpdateModal
        jobId={jobId}
        currentStatus={currentStatus}
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
      />

      <AssignEngineerModal
        jobId={jobId}
        currentAssigneeId={currentAssigneeId}
        engineers={engineers}
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
      />
    </>
  )
}

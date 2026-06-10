import { format } from "date-fns"
import { JOB_STATUS_LABELS } from "@/types"
import type { JobStatus, JobStatusLog, User } from "@/types"

type LogEntry = Pick<JobStatusLog, "id" | "fromStatus" | "toStatus" | "note" | "createdAt"> & {
  changedBy: Pick<User, "id" | "name">
}

const STATUS_COLORS: Partial<Record<JobStatus, string>> = {
  RECEIVED: "bg-slate-400",
  DIAGNOSING: "bg-blue-400",
  WAITING_SPARE_PARTS: "bg-orange-400",
  WAITING_CUSTOMER_APPROVAL: "bg-yellow-400",
  REPAIRING: "bg-violet-400",
  TESTING: "bg-cyan-400",
  READY_FOR_COLLECTION: "bg-emerald-400",
  DELIVERED: "bg-green-500",
  CANCELLED: "bg-red-400",
}

export function StatusTimeline({ logs }: { logs: LogEntry[] }) {
  if (logs.length === 0) {
    return <p className="text-sm text-slate-400 italic">No status history yet.</p>
  }

  return (
    <ol className="relative border-l border-slate-200 ml-2 space-y-4">
      {logs.map((log) => {
        const toStatus = log.toStatus as JobStatus
        const dotColor = STATUS_COLORS[toStatus] ?? "bg-slate-300"
        return (
          <li key={log.id} className="ml-4">
            <span className={`absolute -left-[7px] mt-1.5 h-3.5 w-3.5 rounded-full border-2 border-white ${dotColor}`} />
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-slate-900">
                {JOB_STATUS_LABELS[toStatus] ?? toStatus}
              </span>
              {log.fromStatus && (
                <span className="text-xs text-slate-400">
                  from {JOB_STATUS_LABELS[log.fromStatus as JobStatus] ?? log.fromStatus}
                </span>
              )}
              <span className="text-xs text-slate-400 ml-auto">
                {format(new Date(log.createdAt), "dd MMM yyyy, HH:mm")}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">by {log.changedBy.name}</p>
            {log.note && (
              <p className="mt-1 text-sm text-slate-600 bg-slate-50 rounded-md px-3 py-1.5 italic">
                {log.note}
              </p>
            )}
          </li>
        )
      })}
    </ol>
  )
}

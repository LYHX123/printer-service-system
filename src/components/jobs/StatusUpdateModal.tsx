"use client"

import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { StatusUpdateSchema, type StatusUpdateInput } from "@/lib/schemas"
import { updateJobStatus } from "@/lib/actions/jobs"
import { Modal } from "@/components/ui/modal"
import { FormField, Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { JOB_STATUS_LABELS, JOB_STATUS_TRANSITIONS } from "@/types"
import type { JobStatus } from "@/types"

interface StatusUpdateModalProps {
  jobId: string
  currentStatus: JobStatus
  open: boolean
  onClose: () => void
}

export function StatusUpdateModal({ jobId, currentStatus, open, onClose }: StatusUpdateModalProps) {
  const router = useRouter()
  const toast = useToast()

  const allowedTransitions = JOB_STATUS_TRANSITIONS[currentStatus] ?? []

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<StatusUpdateInput>({
    resolver: zodResolver(StatusUpdateSchema) as Resolver<StatusUpdateInput>,
    defaultValues: {
      toStatus: allowedTransitions[0],
      note: "",
    },
  })

  const toStatus = watch("toStatus")

  function handleClose() {
    reset()
    onClose()
  }

  async function onSubmit(data: StatusUpdateInput) {
    const result = await updateJobStatus(jobId, data)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    toast.success("Status updated")
    reset()
    onClose()
    router.refresh()
  }

  if (allowedTransitions.length === 0) return null

  return (
    <Modal
      isOpen={open}
      onClose={handleClose}
      title="Update Job Status"
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="status-update-form" loading={isSubmitting}>
            Update Status
          </Button>
        </div>
      }
    >
      <form id="status-update-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Current status:{" "}
            <span className="font-semibold text-slate-900">{JOB_STATUS_LABELS[currentStatus]}</span>
          </p>

          <FormField label="Move to" htmlFor="toStatus" required error={errors.toStatus?.message}>
            <Select id="toStatus" {...register("toStatus")} error={errors.toStatus?.message}>
              {allowedTransitions.map((s) => (
                <option key={s} value={s}>{JOB_STATUS_LABELS[s]}</option>
              ))}
            </Select>
          </FormField>

          {toStatus === "DELIVERED" && (
            <FormField label="Warranty Period (days)" htmlFor="warrantyPeriod" required error={errors.warrantyPeriod?.message}>
              <Input
                id="warrantyPeriod"
                type="number"
                min="1"
                step="1"
                placeholder="e.g. 90"
                {...register("warrantyPeriod")}
              />
            </FormField>
          )}

          <FormField
            label={toStatus === "CANCELLED" ? "Reason for cancellation" : "Note (optional)"}
            htmlFor="note"
            required={toStatus === "CANCELLED"}
            error={errors.note?.message}
          >
            <Textarea
              id="note"
              rows={3}
              placeholder={
                toStatus === "CANCELLED"
                  ? "e.g. Customer requested cancellation — device collected without repair"
                  : "e.g. Awaiting HP toner cartridge, ETA 3 days"
              }
              {...register("note")}
            />
          </FormField>
        </div>
      </form>
    </Modal>
  )
}

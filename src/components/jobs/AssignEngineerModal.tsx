"use client"

import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { AssignEngineerSchema, type AssignEngineerInput } from "@/lib/schemas"
import { assignEngineer } from "@/lib/actions/jobs"
import { Modal } from "@/components/ui/modal"
import { FormField } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { ROLE_LABELS } from "@/types"
import type { User, Role } from "@/types"

type EngineerOption = Pick<User, "id" | "name" | "email" | "role">

interface AssignEngineerModalProps {
  jobId: string
  currentAssigneeId: string
  engineers: EngineerOption[]
  open: boolean
  onClose: () => void
}

export function AssignEngineerModal({
  jobId,
  currentAssigneeId,
  engineers,
  open,
  onClose,
}: AssignEngineerModalProps) {
  const router = useRouter()
  const toast = useToast()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AssignEngineerInput>({
    resolver: zodResolver(AssignEngineerSchema) as Resolver<AssignEngineerInput>,
    defaultValues: { assignedToId: currentAssigneeId },
  })

  function handleClose() {
    reset({ assignedToId: currentAssigneeId })
    onClose()
  }

  async function onSubmit(data: AssignEngineerInput) {
    const result = await assignEngineer(jobId, data)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    toast.success("Engineer assigned")
    reset()
    onClose()
    router.refresh()
  }

  return (
    <Modal
      isOpen={open}
      onClose={handleClose}
      title="Assign Engineer"
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="assign-engineer-form" loading={isSubmitting}>
            Assign
          </Button>
        </div>
      }
    >
      <form id="assign-engineer-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label="Engineer" htmlFor="assignedToId" required error={errors.assignedToId?.message}>
          <Select id="assignedToId" {...register("assignedToId")} error={errors.assignedToId?.message}>
            {engineers.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} — {ROLE_LABELS[e.role as Role]}
              </option>
            ))}
          </Select>
        </FormField>
      </form>
    </Modal>
  )
}

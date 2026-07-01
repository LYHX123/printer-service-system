"use client"

import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AddTaskStepSchema, type AddTaskStepInput } from "@/lib/schemas"
import { addTaskStep } from "@/lib/actions/tasks"
import { Modal } from "@/components/ui/modal"
import { FormField, Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"

interface AddStepModalProps {
  isOpen: boolean
  onClose: () => void
  taskId: string
  nextStepNumber: number
}

export function AddStepModal({ isOpen, onClose, taskId, nextStepNumber }: AddStepModalProps) {
  const router = useRouter()
  const toast = useToast()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddTaskStepInput>({
    resolver: zodResolver(AddTaskStepSchema),
    defaultValues: { title: "", description: "" },
  })

  function handleClose() {
    reset()
    onClose()
  }

  async function onSubmit(data: AddTaskStepInput) {
    const result = await addTaskStep(taskId, data)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    toast.success("Step added")
    handleClose()
    router.refresh()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Add Step ${nextStepNumber}`}
      description="Describe what was done or what happens next."
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-step-form" loading={isSubmitting}>
            Add Step
          </Button>
        </div>
      }
    >
      <form id="add-step-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField label="Step Title" htmlFor="stepTitle" required error={errors.title?.message}>
          <Input id="stepTitle" placeholder="e.g. Arranged, Completed, Delivered" {...register("title")} />
        </FormField>
        <FormField label="Description" htmlFor="stepDesc" error={errors.description?.message}>
          <Textarea
            id="stepDesc"
            rows={4}
            placeholder="Add details about this step…"
            {...register("description")}
          />
        </FormField>
      </form>
    </Modal>
  )
}

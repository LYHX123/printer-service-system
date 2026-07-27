"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AddTaskStepSchema, type AddTaskStepInput } from "@/lib/schemas"
import { updateTaskStep } from "@/lib/actions/tasks"
import { Modal } from "@/components/ui/modal"
import { FormField, Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"

interface EditStepModalProps {
  isOpen: boolean
  onClose: () => void
  step: { id: string; title: string; description: string | null } | null
}

export function EditStepModal({ isOpen, onClose, step }: EditStepModalProps) {
  const router = useRouter()
  const toast = useToast()
  const { t, language } = useLanguage()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddTaskStepInput>({
    resolver: zodResolver(AddTaskStepSchema),
    defaultValues: { title: "", description: "" },
  })

  useEffect(() => {
    if (isOpen && step) {
      reset({ title: step.title, description: step.description ?? "" })
    }
  }, [isOpen, step, reset])

  async function onSubmit(data: AddTaskStepInput) {
    if (!step) return
    const result = await updateTaskStep(step.id, data)
    if (result?.error) {
      toast.error(result.error === "Forbidden" ? t("noPermissionForAction") : result.error)
      return
    }
    toast.success(t("progressNodeUpdated"))
    onClose()
    router.refresh()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("editProgressNode")}
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" form="edit-step-form" loading={isSubmitting}>
            {t("saveChanges")}
          </Button>
        </div>
      }
    >
      <form id="edit-step-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField
          label={t("taskStepTitleField")}
          htmlFor="editStepTitle"
          required
          error={errors.title ? t("taskStepTitleRequired") : undefined}
        >
          <Input
            id="editStepTitle"
            placeholder={language === "zh" ? "例如：已安排、已完成、已送达" : "e.g. Arranged, Completed, Delivered"}
            {...register("title")}
          />
        </FormField>
        <FormField
          label={t("description")}
          htmlFor="editStepDesc"
          error={errors.description?.message}
        >
          <Textarea
            id="editStepDesc"
            rows={4}
            {...register("description")}
          />
        </FormField>
      </form>
    </Modal>
  )
}

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
import { useLanguage } from "@/lib/i18n/LanguageContext"

interface AddStepModalProps {
  isOpen: boolean
  onClose: () => void
  taskId: string
  nextStepNumber: number
}

export function AddStepModal({ isOpen, onClose, taskId, nextStepNumber }: AddStepModalProps) {
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
    toast.success(t("taskStepAdded"))
    handleClose()
    router.refresh()
  }

  const modalTitle = language === "zh"
    ? `添加第 ${nextStepNumber} 步`
    : `${t("taskAddNextStep")} ${nextStepNumber}`

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={modalTitle}
      description={t("taskAddStepModalDesc")}
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" form="add-step-form" loading={isSubmitting}>
            {t("taskAddStepAction")}
          </Button>
        </div>
      }
    >
      <form id="add-step-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField
          label={t("taskStepTitleField")}
          htmlFor="stepTitle"
          required
          error={errors.title ? t("taskStepTitleRequired") : undefined}
        >
          <Input
            id="stepTitle"
            placeholder={language === "zh" ? "例如：已安排、已完成、已送达" : "e.g. Arranged, Completed, Delivered"}
            {...register("title")}
          />
        </FormField>
        <FormField
          label={t("description")}
          htmlFor="stepDesc"
          error={errors.description?.message}
        >
          <Textarea
            id="stepDesc"
            rows={4}
            placeholder={language === "zh" ? "添加此步骤的详细信息..." : "Add details about this step…"}
            {...register("description")}
          />
        </FormField>
      </form>
    </Modal>
  )
}

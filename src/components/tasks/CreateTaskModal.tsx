"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { CreateTaskSchema, type CreateTaskInput } from "@/lib/schemas"
import { createTask } from "@/lib/actions/tasks"
import { Modal } from "@/components/ui/modal"
import { FormField, Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { cn } from "@/lib/utils"

interface UserOption {
  id: string
  name: string
  role: string
}

interface CreateTaskModalProps {
  isOpen: boolean
  onClose: () => void
  users: UserOption[]
  currentUserId: string
  onCreated?: (taskId: string) => void
}

export function CreateTaskModal({
  isOpen,
  onClose,
  users,
  currentUserId,
  onCreated,
}: CreateTaskModalProps) {
  const router = useRouter()
  const toast = useToast()
  const { t, language } = useLanguage()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set([currentUserId]))
  const [search, setSearch] = useState("")

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateTaskInput>({
    resolver: zodResolver(CreateTaskSchema),
    defaultValues: {
      title: "",
      initialStepTitle: "",
      initialStepDescription: "",
      participantIds: [currentUserId],
    },
  })

  function handleClose() {
    reset({
      title: "",
      initialStepTitle: "",
      initialStepDescription: "",
      participantIds: [currentUserId],
    })
    setSelectedIds(new Set([currentUserId]))
    setSearch("")
    onClose()
  }

  function toggleUser(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
    setValue("participantIds", Array.from(next), { shouldValidate: true })
  }

  async function onSubmit(data: CreateTaskInput) {
    const result = await createTask(data)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    toast.success(t("taskCreatedSuccess"))
    reset({
      title: "",
      initialStepTitle: "",
      initialStepDescription: "",
      participantIds: [currentUserId],
    })
    setSelectedIds(new Set([currentUserId]))
    setSearch("")
    if (result.taskId) onCreated?.(result.taskId)
    else onClose()
    router.refresh()
  }

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase())
  )

  const participantCountText = language === "zh"
    ? `已选择 ${selectedIds.size} 位参与人`
    : `${selectedIds.size} participant${selectedIds.size !== 1 ? "s" : ""} selected`

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t("taskCreateTask")}
      description={t("taskModalDesc")}
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
            {t("cancel")}
          </Button>
          <Button type="submit" form="create-task-form" loading={isSubmitting}>
            {t("taskCreateTask")}
          </Button>
        </div>
      }
    >
      <form id="create-task-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField
          label={t("taskTitleField")}
          htmlFor="taskTitle"
          required
          error={errors.title ? t("taskTitleRequired") : undefined}
        >
          <Input
            id="taskTitle"
            placeholder={language === "zh" ? "例如：在总部安装打印机" : "e.g. Install Printer at HQ"}
            {...register("title")}
          />
        </FormField>

        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
            {t("taskInitialStep")}
          </p>
          <div className="space-y-3">
            <FormField
              label={t("taskStepTitleField")}
              htmlFor="stepTitle"
              required
              error={errors.initialStepTitle ? t("taskStepTitleRequired") : undefined}
            >
              <Input
                id="stepTitle"
                placeholder={language === "zh" ? "例如：安装打印机" : "e.g. Install Printer"}
                {...register("initialStepTitle")}
              />
            </FormField>
            <FormField
              label={t("description")}
              htmlFor="stepDesc"
              error={errors.initialStepDescription ? t("description") : undefined}
            >
              <Textarea
                id="stepDesc"
                rows={3}
                placeholder={language === "zh" ? "描述需要完成的事项..." : "Describe what needs to happen…"}
                {...register("initialStepDescription")}
              />
            </FormField>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
            {t("taskParticipantsLabel")} <span className="text-red-500">*</span>
          </p>
          {errors.participantIds && (
            <p className="text-xs text-red-600 mb-2">{t("taskParticipantRequired")}</p>
          )}
          <Input
            placeholder={t("taskSearchStaff")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-2"
          />
          <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
            {filteredUsers.length === 0 ? (
              <p className="px-3 py-2 text-sm text-slate-400">{t("taskNoUsersFound")}</p>
            ) : (
              filteredUsers.map((u) => {
                const checked = selectedIds.has(u.id)
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleUser(u.id)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                      checked ? "bg-blue-50" : "hover:bg-slate-50"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                        checked ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-white"
                      )}
                    >
                      {checked && (
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 12 12">
                          <path
                            d="M2 6l3 3 5-5"
                            stroke="currentColor"
                            strokeWidth={1.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                    <span className="font-medium text-slate-900">{u.name}</span>
                    <span className="ml-auto text-xs text-slate-400 capitalize">
                      {u.role.toLowerCase()}
                    </span>
                  </button>
                )
              })
            )}
          </div>
          {selectedIds.size > 0 && (
            <p className="mt-1 text-xs text-slate-500">{participantCountText}</p>
          )}
        </div>
      </form>
    </Modal>
  )
}

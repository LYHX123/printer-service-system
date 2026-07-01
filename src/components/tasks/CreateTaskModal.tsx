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
}

export function CreateTaskModal({ isOpen, onClose, users, currentUserId }: CreateTaskModalProps) {
  const router = useRouter()
  const toast = useToast()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set([currentUserId]))
  const [participantError, setParticipantError] = useState("")
  const [search, setSearch] = useState("")

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateTaskInput>({
    resolver: zodResolver(CreateTaskSchema),
    defaultValues: { title: "", initialStepTitle: "", initialStepDescription: "", participantIds: [] },
  })

  function handleClose() {
    reset()
    setSelectedIds(new Set([currentUserId]))
    setParticipantError("")
    setSearch("")
    onClose()
  }

  function toggleUser(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setParticipantError("")
  }

  async function onSubmit(data: CreateTaskInput) {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) {
      setParticipantError("Select at least one participant")
      return
    }
    const result = await createTask({ ...data, participantIds: ids })
    if (result?.error) {
      toast.error(result.error)
      return
    }
    toast.success("Task created")
    handleClose()
    router.refresh()
  }

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create Task"
      description="Create a new task and assign participants."
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" form="create-task-form" loading={isSubmitting}>
            Create Task
          </Button>
        </div>
      }
    >
      <form id="create-task-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField label="Task Title" htmlFor="taskTitle" required error={errors.title?.message}>
          <Input id="taskTitle" placeholder="e.g. Install Printer at HQ" {...register("title")} />
        </FormField>

        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
            Initial Step
          </p>
          <div className="space-y-3">
            <FormField
              label="Step Title"
              htmlFor="stepTitle"
              required
              error={errors.initialStepTitle?.message}
            >
              <Input
                id="stepTitle"
                placeholder="e.g. Install Printer"
                {...register("initialStepTitle")}
              />
            </FormField>
            <FormField
              label="Description"
              htmlFor="stepDesc"
              error={errors.initialStepDescription?.message}
            >
              <Textarea
                id="stepDesc"
                rows={3}
                placeholder="Describe what needs to happen…"
                {...register("initialStepDescription")}
              />
            </FormField>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
            Participants <span className="text-red-500">*</span>
          </p>
          {participantError && (
            <p className="text-xs text-red-600 mb-2">{participantError}</p>
          )}
          <Input
            placeholder="Search staff…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-2"
          />
          <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
            {filteredUsers.length === 0 ? (
              <p className="px-3 py-2 text-sm text-slate-400">No users found</p>
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
                        checked
                          ? "border-blue-600 bg-blue-600"
                          : "border-slate-300 bg-white"
                      )}
                    >
                      {checked && (
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 12 12">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span className="font-medium text-slate-900">{u.name}</span>
                    <span className="ml-auto text-xs text-slate-400 capitalize">{u.role.toLowerCase()}</span>
                  </button>
                )
              })
            )}
          </div>
          {selectedIds.size > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              {selectedIds.size} participant{selectedIds.size !== 1 ? "s" : ""} selected
            </p>
          )}
        </div>
      </form>
    </Modal>
  )
}

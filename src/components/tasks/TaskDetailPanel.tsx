"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Plus, CheckCircle2, RotateCcw, Trash2, Pencil, Users, ChevronLeft, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { completeTask, reopenTask, deleteTask, deleteTaskStep, removeTaskParticipant, markTaskAsRead } from "@/lib/actions/tasks"
import {
  canAddTaskStep,
  canCompleteTask,
  canReopenTask,
  canCreateTask,
  canManageTaskStep,
  canManageTaskParticipants,
} from "@/lib/permissions"
import { AddStepModal } from "@/components/tasks/AddStepModal"
import { EditStepModal } from "@/components/tasks/EditStepModal"
import { AddParticipantModal } from "@/components/tasks/AddParticipantModal"
import { TaskStepImages } from "@/components/tasks/TaskStepImages"
import { TaskStatusBadge } from "@/components/tasks/TaskStatusBadge"
import { AppDangerZone } from "@/components/app-ui/AppDangerZone"
import type { TaskWithDetails, TaskStepItem } from "@/lib/data/tasks"
import type { Role } from "@/types"

interface UserOption {
  id: string
  name: string
  role: string
}

interface TaskDetailPanelProps {
  task: TaskWithDetails
  users: UserOption[]
  currentUserId: string
  currentUserRole: Role
  /** Called after a successful delete — desktop picks another task to show, the standalone mobile page navigates back to the list. */
  onDeleted: () => void
  /** Compact single-column App-mode layout instead of the desktop two-column-ish header/actions layout. Same data, same actions either way. */
  compact?: boolean
  /** Rendered as a "< Tasks" back affordance when compact (the desktop embedded panel already has its own lg:hidden back button via the caller). */
  onBack?: () => void
}

function WorkflowNode({
  step,
  isLast,
  isFirst,
  canManageImages,
  canManageNode,
  onEdit,
  onDelete,
  isDeleting,
}: {
  step: TaskWithDetails["steps"][number]
  isLast: boolean
  isFirst: boolean
  canManageImages: boolean
  canManageNode: boolean
  onEdit: () => void
  onDelete: () => void
  isDeleting: boolean
}) {
  const { t } = useLanguage()
  return (
    <div className="animate-task-step flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold",
            isFirst
              ? "border-blue-500 bg-blue-500 text-white"
              : "border-slate-300 bg-white text-slate-500"
          )}
        >
          {step.order}
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-slate-200 my-1 min-h-[2rem]" />}
      </div>

      <div
        className={cn(
          "flex-1 rounded-xl border bg-white shadow-sm mb-4",
          isFirst ? "border-blue-200" : "border-slate-200"
        )}
      >
        <div className="flex items-start justify-between gap-2 px-4 pt-3 pb-1 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 text-sm break-words">{step.title}</h3>
          {canManageNode && (
            <div className="flex shrink-0 items-center gap-0.5 -mr-1">
              <button
                type="button"
                onClick={onEdit}
                disabled={isDeleting}
                aria-label={t("edit")}
                title={t("edit")}
                className="rounded-md p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:pointer-events-none disabled:opacity-50"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={isDeleting}
                aria-label={t("delete")}
                title={t("delete")}
                className="rounded-md p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:pointer-events-none disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
        <div className="px-4 py-3 space-y-2">
          {step.description && (
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{step.description}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>{t("taskBy")} {step.createdBy.name}</span>
            <span>·</span>
            <span>{format(new Date(step.createdAt), "dd MMM yyyy, HH:mm")}</span>
          </div>
          <TaskStepImages stepId={step.id} images={step.images} canManage={canManageImages} />
        </div>
      </div>
    </div>
  )
}

// The single implementation of "view/act on one task" — used both embedded
// in desktop TasksView's right panel and standalone on the App-mode
// /tasks/[id] page. All state, permission checks, and server-action calls
// live here exactly once; only the surrounding layout differs (`compact`).
export function TaskDetailPanel({ task, users, currentUserId, currentUserRole, onDeleted, compact = false, onBack }: TaskDetailPanelProps) {
  const router = useRouter()
  const toast = useToast()
  const { t, language } = useLanguage()

  const [addStepOpen, setAddStepOpen] = useState(false)
  const [addParticipantOpen, setAddParticipantOpen] = useState(false)
  const [editingStep, setEditingStep] = useState<TaskStepItem | null>(null)
  const [isActing, setIsActing] = useState(false)
  const [deletingStepId, setDeletingStepId] = useState<string | null>(null)
  const [removingParticipantId, setRemovingParticipantId] = useState<string | null>(null)

  // Opening a task marks it as viewed for the current user only — every
  // other participant's read state is untouched. Only refreshes when the
  // task actually was unread, so re-opening an already-read task never
  // triggers a pointless list re-fetch.
  useEffect(() => {
    let cancelled = false
    markTaskAsRead(task.id).then((result) => {
      if (!cancelled && result?.success && result.wasUnread) {
        router.refresh()
      }
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id])

  const userCanCreate = canCreateTask(currentUserRole)
  const userCanAddStep = canAddTaskStep(currentUserId, {
    status: task.status,
    createdById: task.createdById,
    participants: task.participants,
  })
  const userCanComplete = canCompleteTask(currentUserId, {
    status: task.status,
    createdById: task.createdById,
    participants: task.participants,
  })
  const userCanReopen = canReopenTask(currentUserRole)
  const userCanDelete = userCanCreate
  const userCanManageParticipants = canManageTaskParticipants(currentUserRole, currentUserId, {
    status: task.status,
    createdById: task.createdById,
  })
  const participantCandidateUsers = users.filter((u) => !task.participants.some((p) => p.userId === u.id))

  async function handleComplete() {
    setIsActing(true)
    const result = await completeTask(task.id)
    setIsActing(false)
    if (result?.error) { toast.error(result.error); return }
    toast.success(t("taskCompletedSuccess"))
    router.refresh()
  }

  async function handleReopen() {
    setIsActing(true)
    const result = await reopenTask(task.id)
    setIsActing(false)
    if (result?.error) { toast.error(result.error); return }
    toast.success(t("taskReopenedSuccess"))
    router.refresh()
  }

  async function handleDelete() {
    const confirmMsg = language === "zh"
      ? `确定要删除任务"${task.title}"？此操作不可撤销。`
      : `Delete task "${task.title}"? This cannot be undone.`
    if (!window.confirm(confirmMsg)) return
    setIsActing(true)
    const result = await deleteTask(task.id)
    setIsActing(false)
    if (result?.error) { toast.error(result.error); return }
    toast.success(t("taskDeletedSuccess"))
    onDeleted()
    router.refresh()
  }

  async function handleDeleteStep(step: TaskStepItem) {
    const confirmMsg = `${t("confirmDeleteProgressNodeQuestion")}\n${t("actionCannotBeUndone")}`
    if (!window.confirm(confirmMsg)) return
    setDeletingStepId(step.id)
    const result = await deleteTaskStep(step.id)
    setDeletingStepId(null)
    if (result?.error) {
      toast.error(result.error === "Forbidden" ? t("noPermissionForAction") : result.error)
      return
    }
    toast.success(t("progressNodeDeleted"))
    router.refresh()
  }

  async function handleRemoveParticipant(participantUserId: string) {
    if (!window.confirm(t("confirmRemoveParticipantQuestion"))) return
    setRemovingParticipantId(participantUserId)
    const result = await removeTaskParticipant(task.id, participantUserId)
    setRemovingParticipantId(null)
    if (result?.error) { toast.error(result.error); return }
    toast.success(t("participantRemovedSuccess"))
    router.refresh()
  }

  const stepsSection = (
    <>
      {task.steps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-slate-400">{t("taskNoSteps")}</p>
        </div>
      ) : (
        <div className={compact ? undefined : "max-w-2xl mx-auto"}>
          {task.steps.map((step, idx) => (
            <WorkflowNode
              key={step.id}
              step={step}
              isFirst={idx === 0}
              isLast={idx === task.steps.length - 1}
              canManageImages={userCanAddStep || currentUserRole === "ADMIN"}
              canManageNode={canManageTaskStep(currentUserRole, currentUserId, step, task)}
              onEdit={() => setEditingStep(step)}
              onDelete={() => handleDeleteStep(step)}
              isDeleting={deletingStepId === step.id}
            />
          ))}

          {task.status === "ACTIVE" && userCanAddStep && (
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-slate-300 text-slate-400">
                  <Plus className="h-4 w-4" />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAddStepOpen(true)}
                className="flex-1 mb-4 rounded-xl border-2 border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-colors text-left"
              >
                {t("taskAddNextStepHint")}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )

  const modals = (
    <>
      <EditStepModal isOpen={!!editingStep} onClose={() => setEditingStep(null)} step={editingStep} />
      <AddStepModal
        isOpen={addStepOpen}
        onClose={() => setAddStepOpen(false)}
        taskId={task.id}
        nextStepNumber={task.steps.length + 1}
      />
      <AddParticipantModal
        isOpen={addParticipantOpen}
        onClose={() => setAddParticipantOpen(false)}
        taskId={task.id}
        candidateUsers={participantCandidateUsers}
      />
    </>
  )

  if (compact) {
    return (
      <div className="space-y-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 active:text-slate-800"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("tasks")}
          </button>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <h1 className="min-w-0 break-words text-[17px] font-bold text-slate-900">{task.title}</h1>
            <span className="shrink-0"><TaskStatusBadge status={task.status} /></span>
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            {t("taskCreatedByLabel")} {task.createdBy.name} · {format(new Date(task.createdAt), "dd MMM yyyy")}
            {task.completedAt && (
              <> · {t("taskStatusCompleted")} {format(new Date(task.completedAt), "dd MMM yyyy")}</>
            )}
          </p>

          {(task.status === "ACTIVE" || (task.status === "COMPLETED" && userCanReopen)) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {task.status === "ACTIVE" && userCanAddStep && (
                <Button size="sm" variant="outline" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setAddStepOpen(true)}>
                  {t("taskAddNextStep")}
                </Button>
              )}
              {task.status === "ACTIVE" && userCanComplete && (
                <Button size="sm" variant="secondary" icon={<CheckCircle2 className="h-3.5 w-3.5" />} loading={isActing} onClick={handleComplete}>
                  {t("taskMarkCompleted")}
                </Button>
              )}
              {task.status === "COMPLETED" && userCanReopen && (
                <Button size="sm" variant="outline" icon={<RotateCcw className="h-3.5 w-3.5" />} loading={isActing} onClick={handleReopen}>
                  {t("taskReopen")}
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("taskParticipantsLabel")}</h3>
            {userCanManageParticipants && (
              <Button size="sm" variant="outline" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setAddParticipantOpen(true)}>
                {t("addParticipant")}
              </Button>
            )}
          </div>
          {task.participants.length === 0 ? (
            <p className="text-sm text-slate-400 italic">{t("taskNoParticipantsYet")}</p>
          ) : (
            <div className="space-y-1.5">
              {task.participants.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-slate-700">
                    <Users className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{p.user.name}</span>
                  </span>
                  {userCanManageParticipants && (
                    <button
                      type="button"
                      onClick={() => handleRemoveParticipant(p.userId)}
                      disabled={removingParticipantId === p.userId}
                      aria-label={t("removeParticipant")}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-red-500 disabled:pointer-events-none disabled:opacity-50"
                    >
                      {removingParticipantId === p.userId ? "…" : <X className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("tasks")}</h3>
          {stepsSection}
        </div>

        {userCanDelete && (
          <AppDangerZone label={t("delete")} onClick={handleDelete} disabled={isActing} icon={<Trash2 className="h-3.5 w-3.5" />} />
        )}

        {modals}
      </div>
    )
  }

  return (
    <>
      <div className="border-b border-slate-200 bg-white px-6 py-4 lg:sticky lg:top-0 lg:z-10">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mb-3 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 lg:hidden"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("tasks")}
          </button>
        )}
        <div className="flex items-start justify-between gap-4 max-lg:flex-col max-lg:items-stretch max-lg:gap-3">
          <div className="min-w-0 max-lg:w-full">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-lg font-bold text-slate-900 break-words whitespace-normal max-lg:w-full max-lg:text-xl max-lg:font-semibold max-lg:leading-snug">
                {task.title}
              </h1>
              <TaskStatusBadge status={task.status} />
            </div>
            <p className="text-xs text-slate-400">
              {t("taskCreatedByLabel")} {task.createdBy.name} · {format(new Date(task.createdAt), "dd MMM yyyy")}
              {task.completedAt && (
                <> · {t("taskStatusCompleted")} {format(new Date(task.completedAt), "dd MMM yyyy")}</>
              )}
            </p>
            {task.participants.length > 0 && (
              <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                <Users className="h-3 w-3" />
                <span>{task.participants.map((p) => p.user.name).join(", ")}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0 max-lg:w-full max-lg:flex-wrap">
            {task.status === "ACTIVE" && (
              <>
                {userCanAddStep && (
                  <Button size="sm" variant="outline" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setAddStepOpen(true)}>
                    {t("taskAddNextStep")}
                  </Button>
                )}
                {userCanComplete && (
                  <Button size="sm" variant="secondary" icon={<CheckCircle2 className="h-3.5 w-3.5" />} loading={isActing} onClick={handleComplete}>
                    {t("taskMarkCompleted")}
                  </Button>
                )}
              </>
            )}
            {task.status === "COMPLETED" && userCanReopen && (
              <Button size="sm" variant="outline" icon={<RotateCcw className="h-3.5 w-3.5" />} loading={isActing} onClick={handleReopen}>
                {t("taskReopen")}
              </Button>
            )}
            {userCanDelete && (
              <Button
                size="sm"
                variant="ghost"
                className="text-red-400 hover:text-red-600 hover:bg-red-50"
                icon={<Trash2 className="h-3.5 w-3.5" />}
                loading={isActing}
                onClick={handleDelete}
              />
            )}
          </div>
        </div>
      </div>

      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("taskParticipantsLabel")}</h3>
          {userCanManageParticipants && (
            <Button size="sm" variant="outline" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setAddParticipantOpen(true)}>
              {t("addParticipant")}
            </Button>
          )}
        </div>
        {task.participants.length === 0 ? (
          <p className="text-sm text-slate-400 italic">{t("taskNoParticipantsYet")}</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 divide-y divide-slate-100">
            {task.participants.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="text-slate-700">{p.user.name}</span>
                {userCanManageParticipants && (
                  <button
                    type="button"
                    onClick={() => handleRemoveParticipant(p.userId)}
                    disabled={removingParticipantId === p.userId}
                    className="text-xs font-medium text-red-500 hover:text-red-700 disabled:pointer-events-none disabled:opacity-50"
                  >
                    {removingParticipantId === p.userId ? (
                      "…"
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <X className="h-3 w-3" />
                        {t("removeParticipant")}
                      </span>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-6 py-6">{stepsSection}</div>

      {modals}
    </>
  )
}

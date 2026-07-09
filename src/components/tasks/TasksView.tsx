"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Plus, CheckCircle2, RotateCcw, Trash2, Users, Clock, ChevronRight, ChevronLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { completeTask, reopenTask, deleteTask } from "@/lib/actions/tasks"
import {
  canCreateTask,
  canAddTaskStep,
  canCompleteTask,
  canReopenTask,
} from "@/lib/permissions"
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal"
import { AddStepModal } from "@/components/tasks/AddStepModal"
import { TaskStepImages } from "@/components/tasks/TaskStepImages"
import type { TaskWithDetails } from "@/lib/data/tasks"
import type { Role } from "@/types"

interface UserOption {
  id: string
  name: string
  role: string
}

interface TasksViewProps {
  tasks: TaskWithDetails[]
  users: UserOption[]
  currentUserId: string
  currentUserRole: Role
}

function TaskStatusBadge({ status }: { status: "ACTIVE" | "COMPLETED" }) {
  const { t } = useLanguage()
  return status === "COMPLETED" ? (
    <Badge className="bg-emerald-100 text-emerald-700">{t("taskStatusCompleted")}</Badge>
  ) : (
    <Badge className="bg-blue-100 text-blue-700">{t("taskStatusActive")}</Badge>
  )
}

function WorkflowNode({
  step,
  isLast,
  isFirst,
  canManageImages,
}: {
  step: TaskWithDetails["steps"][number]
  isLast: boolean
  isFirst: boolean
  canManageImages: boolean
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
        <div className="px-4 pt-3 pb-1 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 text-sm">{step.title}</h3>
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

function EmptyState() {
  const { t } = useLanguage()
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 mb-4">
        <ChevronRight className="h-8 w-8 text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-700">{t("taskSelectATask")}</h3>
      <p className="mt-1 text-sm text-slate-400">{t("taskClickToView")}</p>
    </div>
  )
}

function NoTasksState({ canCreate, onCreate }: { canCreate: boolean; onCreate: () => void }) {
  const { t } = useLanguage()
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 mb-4">
        <CheckCircle2 className="h-8 w-8 text-slate-300" />
      </div>
      <h3 className="text-base font-semibold text-slate-700">{t("taskNoTasksYet")}</h3>
      <p className="mt-1 text-sm text-slate-400">
        {canCreate ? t("taskNoTasksDesc") : t("taskNoTasksAssigned")}
      </p>
      {canCreate && (
        <Button className="mt-4" onClick={onCreate} icon={<Plus className="h-4 w-4" />}>
          {t("taskCreateTask")}
        </Button>
      )}
    </div>
  )
}

export function TasksView({ tasks, users, currentUserId, currentUserRole }: TasksViewProps) {
  const router = useRouter()
  const toast = useToast()
  const { t, language } = useLanguage()

  const [selectedId, setSelectedId] = useState<string | null>(tasks[0]?.id ?? null)
  const [createOpen, setCreateOpen] = useState(false)
  const [addStepOpen, setAddStepOpen] = useState(false)
  const [isActing, setIsActing] = useState(false)

  // On phones, start on the task list instead of jumping straight into the
  // first task's detail pane (which would hide the list behind it). Desktop
  // keeps auto-selecting the first task as before.
  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.matchMedia("(max-width: 1023px)").matches) {
      setSelectedId(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedTask = tasks.find((task) => task.id === selectedId) ?? null
  const userCanCreate = canCreateTask(currentUserRole)

  async function handleComplete() {
    if (!selectedTask) return
    setIsActing(true)
    const result = await completeTask(selectedTask.id)
    setIsActing(false)
    if (result?.error) { toast.error(result.error); return }
    toast.success(t("taskCompletedSuccess"))
    router.refresh()
  }

  async function handleReopen() {
    if (!selectedTask) return
    setIsActing(true)
    const result = await reopenTask(selectedTask.id)
    setIsActing(false)
    if (result?.error) { toast.error(result.error); return }
    toast.success(t("taskReopenedSuccess"))
    router.refresh()
  }

  async function handleDelete() {
    if (!selectedTask) return
    const confirmMsg = language === "zh"
      ? `确定要删除任务"${selectedTask.title}"？此操作不可撤销。`
      : `Delete task "${selectedTask.title}"? This cannot be undone.`
    if (!window.confirm(confirmMsg)) return
    setIsActing(true)
    const result = await deleteTask(selectedTask.id)
    setIsActing(false)
    if (result?.error) { toast.error(result.error); return }
    toast.success(t("taskDeletedSuccess"))
    setSelectedId(tasks.find((task) => task.id !== selectedTask.id)?.id ?? null)
    router.refresh()
  }

  const userCanAddStep = selectedTask
    ? canAddTaskStep(currentUserId, {
        status: selectedTask.status,
        createdById: selectedTask.createdById,
        participants: selectedTask.participants,
      })
    : false

  const userCanComplete = selectedTask
    ? canCompleteTask(currentUserId, {
        status: selectedTask.status,
        createdById: selectedTask.createdById,
        participants: selectedTask.participants,
      })
    : false

  const userCanReopen = canReopenTask(currentUserRole)
  const userCanDelete = userCanCreate

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left Panel: Task List. On phones this is the only pane shown until a task is picked. */}
      <aside
        className={cn(
          "flex w-80 shrink-0 flex-col border-r border-slate-200 bg-white lg:w-2/5",
          "max-lg:w-full",
          selectedTask && "max-lg:hidden"
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold text-slate-800">{t("tasks")}</h2>
          {userCanCreate && (
            <Button
              size="sm"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => setCreateOpen(true)}
            >
              {t("taskNewTask")}
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {tasks.length === 0 ? (
            <NoTasksState canCreate={userCanCreate} onCreate={() => setCreateOpen(true)} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {tasks.map((task) => {
                const isCompleted = task.status === "COMPLETED"
                const isSelected = task.id === selectedId
                return (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(task.id)}
                      className={cn(
                        "w-full px-4 py-3 text-left transition-colors",
                        isSelected
                          ? "bg-blue-50 border-l-2 border-blue-500"
                          : "hover:bg-slate-50 border-l-2 border-transparent",
                        isCompleted && !isSelected && "opacity-50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span
                          className={cn(
                            "text-sm font-medium leading-snug",
                            isCompleted ? "text-slate-400 line-through" : "text-slate-900"
                          )}
                        >
                          {task.title}
                        </span>
                        <TaskStatusBadge status={task.status} />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Clock className="h-3 w-3" />
                        <span>{format(new Date(task.createdAt), "dd MMM yyyy")}</span>
                      </div>
                      {task.participants.length > 0 && (
                        <div className="mt-1.5 flex items-center gap-1 text-xs text-slate-400">
                          <Users className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {task.participants.map((p) => p.user.name).join(", ")}
                          </span>
                        </div>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Right Panel: Task Detail. On phones this only shows once a task is picked. */}
      <main
        className={cn(
          "flex min-w-0 flex-1 flex-col overflow-hidden bg-slate-50",
          !selectedTask && "max-lg:hidden"
        )}
      >
        {!selectedTask ? (
          <EmptyState />
        ) : (
          <>
            <div className="border-b border-slate-200 bg-white px-6 py-4">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="mb-3 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 lg:hidden"
              >
                <ChevronLeft className="h-4 w-4" />
                {t("tasks")}
              </button>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-lg font-bold text-slate-900">{selectedTask.title}</h1>
                    <TaskStatusBadge status={selectedTask.status} />
                  </div>
                  <p className="text-xs text-slate-400">
                    {t("taskCreatedByLabel")} {selectedTask.createdBy.name} · {format(new Date(selectedTask.createdAt), "dd MMM yyyy")}
                    {selectedTask.completedAt && (
                      <> · {t("taskStatusCompleted")} {format(new Date(selectedTask.completedAt), "dd MMM yyyy")}</>
                    )}
                  </p>
                  {selectedTask.participants.length > 0 && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                      <Users className="h-3 w-3" />
                      <span>{selectedTask.participants.map((p) => p.user.name).join(", ")}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {selectedTask.status === "ACTIVE" && (
                    <>
                      {userCanAddStep && (
                        <Button
                          size="sm"
                          variant="outline"
                          icon={<Plus className="h-3.5 w-3.5" />}
                          onClick={() => setAddStepOpen(true)}
                        >
                          {t("taskAddNextStep")}
                        </Button>
                      )}
                      {userCanComplete && (
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                          loading={isActing}
                          onClick={handleComplete}
                        >
                          {t("taskMarkCompleted")}
                        </Button>
                      )}
                    </>
                  )}
                  {selectedTask.status === "COMPLETED" && userCanReopen && (
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<RotateCcw className="h-3.5 w-3.5" />}
                      loading={isActing}
                      onClick={handleReopen}
                    >
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

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {selectedTask.steps.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-sm text-slate-400">{t("taskNoSteps")}</p>
                </div>
              ) : (
                <div className="max-w-2xl mx-auto">
                  {selectedTask.steps.map((step, idx) => (
                    <WorkflowNode
                      key={step.id}
                      step={step}
                      isFirst={idx === 0}
                      isLast={idx === selectedTask.steps.length - 1}
                      canManageImages={userCanAddStep || currentUserRole === "ADMIN"}
                    />
                  ))}

                  {selectedTask.status === "ACTIVE" && userCanAddStep && (
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
            </div>
          </>
        )}
      </main>

      {/* Modals */}
      <CreateTaskModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        users={users}
        currentUserId={currentUserId}
        onCreated={(taskId) => {
          setCreateOpen(false)
          setSelectedId(taskId)
        }}
      />
      {selectedTask && (
        <AddStepModal
          isOpen={addStepOpen}
          onClose={() => setAddStepOpen(false)}
          taskId={selectedTask.id}
          nextStepNumber={selectedTask.steps.length + 1}
        />
      )}
    </div>
  )
}

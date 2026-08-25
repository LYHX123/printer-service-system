"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { format } from "date-fns"
import { Plus, CheckCircle2, Users, Clock, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { useAppMode } from "@/components/platform/AppModeProvider"
import { canCreateTask } from "@/lib/permissions"
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal"
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel"
import { TaskStatusBadge } from "@/components/tasks/TaskStatusBadge"
import { AppCard } from "@/components/app-ui/AppCard"
import { AppListMeta } from "@/components/app-ui/AppListMeta"
import { OVERDUE_DAYS } from "@/lib/task-constants"
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
  const searchParams = useSearchParams()
  const { t } = useLanguage()
  const isAppMode = useAppMode()
  // Lazy-initialized once (not `Date.now()` inline during render, which
  // React's purity rules flag) — a stable "as of page load" reference is
  // exactly what "N days inactive" needs; it doesn't have to tick live.
  const [now] = useState(() => Date.now())

  // A `?taskId=` deep link (from the Dashboard's overdue-task alerts/recent-tasks
  // list) is resolved directly into the initial state below rather than via a
  // post-mount effect, so it applies on the very first render, on any viewport.
  // App mode never uses this — a task card there navigates straight to its
  // own /tasks/[id] page instead of selecting inline.
  const linkedTaskId = searchParams.get("taskId")
  const hasValidDeepLink = Boolean(linkedTaskId && tasks.some((task) => task.id === linkedTaskId))
  const [selectedId, setSelectedId] = useState<string | null>(
    hasValidDeepLink ? linkedTaskId : (tasks[0]?.id ?? null)
  )
  const [createOpen, setCreateOpen] = useState(false)

  const listRef = useRef<HTMLElement>(null)
  const detailRef = useRef<HTMLElement>(null)

  function isMobileViewport() {
    return typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches
  }

  // Below `lg`, list and detail are stacked in normal document flow (no
  // sticky/hide-swap panes), so "selecting" a task scrolls its detail into
  // view instead of swapping panes. (Desktop/tablet only — App mode never
  // calls this, it navigates to /tasks/[id] instead.)
  function selectTask(taskId: string) {
    setSelectedId(taskId)
    if (isMobileViewport()) {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  function backToList() {
    setSelectedId(null)
    if (isMobileViewport()) {
      listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  // On phones, start on the task list instead of jumping straight into the
  // first task's detail pane (which would hide the list behind it). Desktop
  // keeps auto-selecting the first task as before. Skipped entirely when a
  // `?taskId=` deep link already picked a task (see initial state above) —
  // that selection should stick on every viewport.
  useEffect(() => {
    if (hasValidDeepLink) {
      if (isMobileViewport()) {
        requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
      }
      return
    }
    if (typeof window === "undefined") return
    if (window.matchMedia("(max-width: 1023px)").matches) {
      setSelectedId(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedTask = tasks.find((task) => task.id === selectedId) ?? null
  const userCanCreate = canCreateTask(currentUserRole)

  return (
    <div className="flex flex-col lg:flex-row lg:items-start">
      {/* Left Panel: Task List. Normal document flow on phones/tablets; on
          desktop it gets its own independent scroll region (sticky + max-h),
          mirroring the right panel, so scrolling one never moves the other
          and the currently-selected task stays reachable without dragging
          the whole page. In App mode this is the ENTIRE page — no detail
          pane is rendered alongside it (see below). */}
      <aside
        ref={listRef}
        className={cn(
          "flex w-full flex-col border-r border-slate-200 bg-white",
          !isAppMode && "lg:w-2/5 lg:sticky lg:top-16 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto"
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:sticky lg:top-0 lg:z-10">
          {isAppMode ? (
            <p className="text-sm text-slate-500">
              {tasks.length} {t("tasks")}
            </p>
          ) : (
            <h2 className="font-semibold text-slate-800">{t("tasks")}</h2>
          )}
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

        <div className={isAppMode ? "p-3" : undefined}>
          {tasks.length === 0 ? (
            <NoTasksState canCreate={userCanCreate} onCreate={() => setCreateOpen(true)} />
          ) : isAppMode ? (
            <div className="space-y-2">
              {tasks.map((task) => {
                const isCompleted = task.status === "COMPLETED"
                const isOverdue =
                  !isCompleted &&
                  now - new Date(task.lastActivityAt).getTime() >= OVERDUE_DAYS * 24 * 60 * 60 * 1000
                return (
                  <AppCard
                    key={task.id}
                    onClick={() => router.push(`/tasks/${task.id}`)}
                    className={isCompleted ? "opacity-60" : undefined}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        {task.unread && (
                          <span
                            aria-label={t("taskUnreadIndicator")}
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500"
                          />
                        )}
                        <span
                          className={cn(
                            "truncate text-[14px] font-semibold leading-snug",
                            isCompleted ? "text-slate-400 line-through" : "text-slate-900"
                          )}
                        >
                          {task.title}
                        </span>
                      </span>
                      {isOverdue ? (
                        <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-700">
                          {t("taskOverdueNotice")}
                        </span>
                      ) : (
                        <span className="shrink-0">
                          <TaskStatusBadge status={task.status} />
                        </span>
                      )}
                    </div>
                    {task.participants.length > 0 && (
                      <AppListMeta icon={<Users />} className="mt-1">
                        {task.participants.map((p) => p.user.name).join(", ")}
                      </AppListMeta>
                    )}
                    <AppListMeta icon={<Clock />} className="mt-0.5">
                      {format(new Date(task.createdAt), "dd MMM yyyy")}
                    </AppListMeta>
                  </AppCard>
                )
              })}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {tasks.map((task) => {
                const isCompleted = task.status === "COMPLETED"
                const isSelected = task.id === selectedId
                return (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => selectTask(task.id)}
                      className={cn(
                        "w-full px-4 py-3 text-left transition-colors",
                        isSelected
                          ? "bg-blue-50 border-l-2 border-blue-500"
                          : "hover:bg-slate-50 border-l-2 border-transparent",
                        isCompleted && !isSelected && "opacity-50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          {task.unread && (
                            <span
                              aria-label={t("taskUnreadIndicator")}
                              className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500"
                            />
                          )}
                          <span
                            className={cn(
                              "text-sm font-medium leading-snug",
                              isCompleted ? "text-slate-400 line-through" : "text-slate-900"
                            )}
                          >
                            {task.title}
                          </span>
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

      {/* Right Panel: Task Detail. Desktop/tablet only — App mode shows only
          the list above; tapping a task navigates to its own /tasks/[id]
          page instead. Sticky + internally scrolling on desktop (the one
          place a nested scrollbar is intentional); stacked, normal flow, no
          sticky on tablets. */}
      {!isAppMode && (
        <main
          ref={detailRef}
          className="flex min-w-0 flex-1 flex-col bg-slate-50 lg:sticky lg:top-16 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto"
        >
          {!selectedTask ? (
            <EmptyState />
          ) : (
            <TaskDetailPanel
              task={selectedTask}
              users={users}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              onBack={backToList}
              onDeleted={() => setSelectedId(tasks.find((task) => task.id !== selectedTask.id)?.id ?? null)}
            />
          )}
        </main>
      )}

      <CreateTaskModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        users={users}
        currentUserId={currentUserId}
        onCreated={(taskId) => {
          setCreateOpen(false)
          if (isAppMode) {
            router.push(`/tasks/${taskId}`)
          } else {
            setSelectedId(taskId)
          }
        }}
      />
    </div>
  )
}

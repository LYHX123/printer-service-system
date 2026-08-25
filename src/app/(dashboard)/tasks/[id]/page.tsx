import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { canAccess } from "@/lib/permissions"
import { getVisibleTasks } from "@/lib/data/tasks"
import { getUsers } from "@/lib/data/users"
import { isCapacitorAppRequest } from "@/lib/platform/app-mode"
import { TaskDetailMobilePage } from "@/components/tasks/TaskDetailMobilePage"
import type { Role } from "@/types"

// App-mode-only dedicated Task Detail page. Desktop/mobile-web keep the
// existing master-detail experience in TasksView (list + inline detail) —
// this route just reuses the same ?taskId= deep-link mechanism the
// Dashboard's task alerts already navigate with, rather than introducing a
// second detail UI for non-App visitors.
export default async function TaskDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  if (!canAccess(session!.user.role as Role, "tasks", session!.user.modulePermissions)) redirect("/dashboard")

  const isAppMode = await isCapacitorAppRequest()
  if (!isAppMode) {
    redirect(`/tasks?taskId=${id}`)
  }

  const companyId = session!.user.companyId as string
  const userId = session!.user.id as string
  const role = session!.user.role as Role

  const [tasks, allUsers] = await Promise.all([
    getVisibleTasks(companyId, userId, role),
    getUsers(companyId),
  ])

  const task = tasks.find((t) => t.id === id)
  if (!task) redirect("/tasks")

  const activeUsers = allUsers
    .filter((u) => u.isActive)
    .map((u) => ({ id: u.id, name: u.name, role: u.role }))

  return (
    <TaskDetailMobilePage
      task={task}
      users={activeUsers}
      currentUserId={userId}
      currentUserRole={role}
    />
  )
}

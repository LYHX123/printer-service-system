import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { canAccess } from "@/lib/permissions"
import { getVisibleTasks } from "@/lib/data/tasks"
import { getUsers } from "@/lib/data/users"
import { TasksView } from "@/components/tasks/TasksView"
import type { Role } from "@/types"

export default async function TasksPage() {
  const session = await auth()
  if (!canAccess(session!.user.role as Role, "tasks")) redirect("/dashboard")

  const companyId = session!.user.companyId as string
  const userId = session!.user.id as string
  const role = session!.user.role as Role

  const [tasks, allUsers] = await Promise.all([
    getVisibleTasks(companyId, userId, role),
    getUsers(companyId),
  ])

  const activeUsers = allUsers
    .filter((u) => u.isActive)
    .map((u) => ({ id: u.id, name: u.name, role: u.role }))

  return (
    <div className="-m-6 h-[calc(100vh-4rem)] overflow-hidden">
      <TasksView
        tasks={tasks}
        users={activeUsers}
        currentUserId={userId}
        currentUserRole={role}
      />
    </div>
  )
}

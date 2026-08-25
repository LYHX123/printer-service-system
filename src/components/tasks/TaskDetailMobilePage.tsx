"use client"

import { useRouter } from "next/navigation"
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel"
import type { TaskWithDetails } from "@/lib/data/tasks"
import type { Role } from "@/types"

interface UserOption {
  id: string
  name: string
  role: string
}

interface TaskDetailMobilePageProps {
  task: TaskWithDetails
  users: UserOption[]
  currentUserId: string
  currentUserRole: Role
}

// Thin client wrapper: the server component route can't hold onClick
// handlers, so this just supplies the "back to list" / "deleted, go back to
// list" navigation around the shared TaskDetailPanel.
export function TaskDetailMobilePage({ task, users, currentUserId, currentUserRole }: TaskDetailMobilePageProps) {
  const router = useRouter()
  return (
    <TaskDetailPanel
      task={task}
      users={users}
      currentUserId={currentUserId}
      currentUserRole={currentUserRole}
      compact
      onBack={() => router.push("/tasks")}
      onDeleted={() => router.push("/tasks")}
    />
  )
}

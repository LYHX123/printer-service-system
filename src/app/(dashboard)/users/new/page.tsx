import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { canManageUsers } from "@/lib/permissions"
import { PageHeader } from "@/components/ui/page-header"
import { UserForm } from "@/components/users/UserForm"
import type { Role } from "@/types"

export default async function NewUserPage() {
  const session = await auth()
  if (!canManageUsers(session!.user.role as Role)) redirect("/users")

  return (
    <div>
      <Link href="/users" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft className="h-4 w-4" />
        Back to Users
      </Link>
      <PageHeader title="New User" subtitle="Create a new staff account and assign a role." />
      <UserForm />
    </div>
  )
}

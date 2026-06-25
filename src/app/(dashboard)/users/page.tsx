import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus } from "lucide-react"
import { auth } from "@/lib/auth"
import { getUsers } from "@/lib/data/users"
import { canAccess, ALL_MODULES, MODULE_LABELS } from "@/lib/permissions"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Table } from "@/components/ui/table"
import { Badge, RoleBadge } from "@/components/ui/badge"
import { UserActions } from "@/components/users/UserActions"
import { T } from "@/components/ui/T"
import { format } from "date-fns"
import type { Role } from "@/types"

function ModulesSummary({ role, permissions }: { role: Role; permissions: string[] }) {
  if (role === "ADMIN") {
    return <Badge className="bg-purple-100 text-purple-700 text-xs">Full Access</Badge>
  }
  if (permissions.length === 0 || permissions.length === ALL_MODULES.length) {
    return <span className="text-xs text-slate-500">All Modules</span>
  }
  const labels = permissions
    .filter((p) => MODULE_LABELS[p as keyof typeof MODULE_LABELS])
    .map((p) => MODULE_LABELS[p as keyof typeof MODULE_LABELS].en)
    .join(", ")
  return (
    <span className="text-xs text-slate-600 block max-w-[180px] truncate" title={labels}>
      {labels}
    </span>
  )
}

export default async function UsersPage() {
  const session = await auth()
  const role = session!.user.role as Role
  const modulePermissions = (session!.user.modulePermissions as string[]) ?? []
  if (!canAccess(role, "users", modulePermissions)) redirect("/dashboard")

  const companyId = session!.user.companyId as string
  const currentUserId = session!.user.id as string

  const users = await getUsers(companyId)

  return (
    <div>
      <PageHeader
        title={<T k="users" />}
        subtitle={<>{users.length} <T k="users" /> <T k="inYourCompany" /></>}
        actions={
          <Link href="/users/new">
            <Button icon={<Plus className="h-4 w-4" />}><T k="newUser" /></Button>
          </Link>
        }
      />

      <Table
        columns={[
          {
            key: "name",
            label: <T k="name" />,
            render: (row) => (
              <div>
                <p className="font-medium text-slate-900">
                  {row.name}
                  {row.id === currentUserId && (
                    <span className="ml-2 text-xs font-normal text-slate-400">(<T k="you" />)</span>
                  )}
                </p>
              </div>
            ),
          },
          {
            key: "email",
            label: <T k="email" />,
            className: "text-slate-600",
          },
          {
            key: "role",
            label: <T k="role" />,
            render: (row) => <RoleBadge role={row.role} />,
          },
          {
            key: "modules",
            label: <T k="moduleAccess" />,
            render: (row) => <ModulesSummary role={row.role} permissions={row.modulePermissions} />,
          },
          {
            key: "status",
            label: <T k="status" />,
            render: (row) =>
              row.isActive ? (
                <Badge className="bg-green-100 text-green-700"><T k="active" /></Badge>
              ) : (
                <Badge className="bg-slate-200 text-slate-600"><T k="disabledStatus" /></Badge>
              ),
          },
          {
            key: "createdAt",
            label: <T k="joined" />,
            render: (row) => (
              <span className="text-slate-500 text-xs whitespace-nowrap">
                {format(new Date(row.createdAt), "dd MMM yyyy")}
              </span>
            ),
          },
          {
            key: "actions",
            label: "",
            headerClassName: "text-right",
            className: "text-right",
            render: (row) => (
              <UserActions
                userId={row.id}
                role={row.role}
                isActive={row.isActive}
                isSelf={row.id === currentUserId}
                modulePermissions={row.modulePermissions}
              />
            ),
          },
        ]}
        data={users}
        keyExtractor={(row) => row.id}
        emptyTitle={<T k="noUsersFound" />}
        emptyDescription={<T k="createFirstStaffAccount" />}
      />
    </div>
  )
}

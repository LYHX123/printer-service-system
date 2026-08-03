import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft, Pencil } from "lucide-react"
import { auth } from "@/lib/auth"
import { getCustomerDetail } from "@/lib/data/customers"
import { getCustomerBranches } from "@/lib/data/customerBranches"
import { getCustomerDocuments } from "@/lib/data/customerDocuments"
import { canAccess, canUploadCustomerFile } from "@/lib/permissions"
import { getCustomerFolderDisplayPath } from "@/lib/dropbox"
import { PageHeader } from "@/components/ui/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ProjectsList } from "@/components/customers/ProjectsList"
import { CustomerDocuments } from "@/components/customers/CustomerDocuments"
import type { Role } from "@/types"

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  const role = session!.user.role as Role
  const permissions = (session!.user.modulePermissions as string[]) ?? []
  if (!canAccess(role, "customers", permissions)) redirect("/dashboard")
  const companyId = session!.user.companyId as string
  const { id } = await params

  const customer = await getCustomerDetail(id, companyId)
  if (!customer) notFound()

  const [projects, documents] = await Promise.all([
    getCustomerBranches(id, companyId),
    getCustomerDocuments(id, companyId),
  ])
  const canManageDocuments = canUploadCustomerFile(role, permissions)

  return (
    <div>
      <Link href="/customers" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft className="h-4 w-4" />
        Back to Customers
      </Link>

      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {customer.companyName}
            {!customer.isActive && <Badge className="bg-slate-100 text-slate-500">Archived</Badge>}
          </span>
        }
        subtitle={customer.code}
        actions={
          <Link href={`/customers/${id}/edit`}>
            <Button variant="outline" icon={<Pencil className="h-4 w-4" />}>
              Edit
            </Button>
          </Link>
        }
      />

      <div className="space-y-5">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Company Information</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-slate-500">Company Name</p>
              <p className="text-sm text-slate-900">{customer.companyName}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">PIN No</p>
              <p className="text-sm text-slate-900">{customer.pinNumber || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Short Name</p>
              <p className="text-sm text-slate-900">{customer.shortName || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Dropbox Folder</p>
              <p className="text-sm text-slate-900 font-mono">
                {customer.shortName ? getCustomerFolderDisplayPath(customer.shortName) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Main Address</p>
              <p className="text-sm text-slate-900">{customer.location || "—"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-medium text-slate-500">Notes</p>
              <p className="text-sm text-slate-900 whitespace-pre-wrap">{customer.notes || "—"}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Head Office Contact</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium text-slate-500">Contact Name</p>
              <p className="text-sm text-slate-900">{customer.name || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Phone</p>
              <p className="text-sm text-slate-900">{customer.phone || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Email</p>
              <p className="text-sm text-slate-900">{customer.email || "—"}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <ProjectsList customerId={id} projects={projects} canManage />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <CustomerDocuments
            customerId={id}
            documents={documents}
            projects={projects}
            canManage={canManageDocuments}
            customerShortName={customer.shortName}
          />
        </div>
      </div>
    </div>
  )
}

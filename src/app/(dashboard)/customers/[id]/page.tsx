import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft, Pencil } from "lucide-react"
import { auth } from "@/lib/auth"
import { getCustomerDetail } from "@/lib/data/customers"
import { getCustomerBranches } from "@/lib/data/customerBranches"
import { getCustomerDocuments } from "@/lib/data/customerDocuments"
import { canAccess, canUploadCustomerFile, canEditCustomer } from "@/lib/permissions"
import { getCustomerFolderDisplayPath } from "@/lib/dropbox"
import { isCapacitorAppRequest } from "@/lib/platform/app-mode"
import { PageHeader } from "@/components/ui/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { T } from "@/components/ui/T"
import { ProjectsList } from "@/components/customers/ProjectsList"
import { CustomerDocuments } from "@/components/customers/CustomerDocuments"
import { AppDetailSection } from "@/components/app-ui/AppDetailSection"
import { AppDetailRow } from "@/components/app-ui/AppDetailRow"
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
  const canEdit = canEditCustomer(role, permissions)
  const isAppMode = await isCapacitorAppRequest()

  if (isAppMode) {
    return (
      <div className="space-y-4">
        <Link href="/customers" className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 active:text-slate-800">
          <ChevronLeft className="h-4 w-4" />
          <T k="customers" />
        </Link>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <h1 className="min-w-0 break-words text-[17px] font-bold text-slate-900">{customer.companyName}</h1>
            {!customer.isActive && <Badge className="shrink-0 bg-slate-100 text-slate-500"><T k="archived" /></Badge>}
          </div>
          {customer.code && <p className="mt-0.5 text-xs text-slate-400">{customer.code}</p>}
          {canEdit && (
            <Link href={`/customers/${id}/edit`} className="mt-3 block">
              <Button variant="outline" size="sm" icon={<Pencil className="h-3.5 w-3.5" />} className="w-full">
                <T k="edit" />
              </Button>
            </Link>
          )}
        </div>

        <AppDetailSection title={<T k="companyInformation" />}>
          <AppDetailRow label={<T k="pinNumber" />} value={customer.pinNumber || "—"} />
          <AppDetailRow label={<T k="shortName" />} value={customer.shortName || "—"} />
          <AppDetailRow
            label={<T k="dropboxFolder" />}
            value={<span className="font-mono text-xs">{customer.shortName ? getCustomerFolderDisplayPath(customer.shortName) : "—"}</span>}
          />
          <AppDetailRow label={<T k="mainAddress" />} value={customer.location || "—"} />
          {customer.notes && (
            <div className="mt-2 border-t border-slate-100 pt-2">
              <p className="text-xs font-medium text-slate-500"><T k="notes" /></p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-900">{customer.notes}</p>
            </div>
          )}
        </AppDetailSection>

        <AppDetailSection title={<T k="headOfficeContact" />}>
          <AppDetailRow label={<T k="contactName" />} value={customer.name || "—"} />
          <AppDetailRow label={<T k="phone" />} value={customer.phone || "—"} />
          <AppDetailRow label={<T k="email" />} value={customer.email || "—"} />
        </AppDetailSection>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <ProjectsList customerId={id} projects={projects} canManage={canEdit} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <CustomerDocuments
            customerId={id}
            documents={documents}
            projects={projects}
            canManage={canManageDocuments}
            customerShortName={customer.shortName}
          />
        </div>
      </div>
    )
  }

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
          canEdit && (
            <Link href={`/customers/${id}/edit`}>
              <Button variant="outline" icon={<Pencil className="h-4 w-4" />}>
                Edit
              </Button>
            </Link>
          )
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
          <ProjectsList customerId={id} projects={projects} canManage={canEdit} />
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

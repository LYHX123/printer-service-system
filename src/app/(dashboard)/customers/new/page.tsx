import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { canAccess } from "@/lib/permissions"
import { PageHeader } from "@/components/ui/page-header"
import { CustomerForm } from "@/components/customers/CustomerForm"
import type { Role } from "@/types"

export default async function NewCustomerPage() {
  const session = await auth()
  const role = session!.user.role as Role
  const permissions = (session!.user.modulePermissions as string[]) ?? []
  if (!canAccess(role, "customers", permissions)) redirect("/dashboard")

  return (
    <div>
      <Link href="/customers" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft className="h-4 w-4" />
        Back to Customers
      </Link>
      <PageHeader title="New Customer" subtitle="Register a new customer account." />
      <CustomerForm />
    </div>
  )
}

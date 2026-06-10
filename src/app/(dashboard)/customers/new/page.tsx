import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { CustomerForm } from "@/components/customers/CustomerForm"

export default function NewCustomerPage() {
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

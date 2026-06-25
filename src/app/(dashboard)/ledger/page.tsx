import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronRight, Wallet, Receipt } from "lucide-react"
import { auth } from "@/lib/auth"
import { canAccess } from "@/lib/permissions"
import { PageHeader } from "@/components/ui/page-header"
import { T } from "@/components/ui/T"
import type { Role } from "@/types"

export default async function LedgerPage() {
  const session = await auth()
  if (!canAccess(session!.user.role as Role, "ledger")) redirect("/dashboard")

  return (
    <div>
      <PageHeader title={<T k="ledger" />} subtitle={<T k="ledgerDesc" />} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/ledger/income-expense"
          className="group rounded-xl border border-slate-200 bg-white p-6 hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <Wallet className="h-5 w-5 text-blue-600" />
            </div>
            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-400 transition-colors" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-slate-900"><T k="incomeExpenseBook" /></h3>
          <p className="mt-1 text-sm text-slate-500"><T k="incomeExpenseBookDesc" /></p>
        </Link>

        <Link
          href="/ledger/sales"
          className="group rounded-xl border border-slate-200 bg-white p-6 hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <Receipt className="h-5 w-5 text-blue-600" />
            </div>
            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-400 transition-colors" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-slate-900"><T k="salesLedger" /></h3>
          <p className="mt-1 text-sm text-slate-500"><T k="salesLedgerDesc" /></p>
        </Link>
      </div>
    </div>
  )
}

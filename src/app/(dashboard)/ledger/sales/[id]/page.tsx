import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft, Clock, User, Receipt } from "lucide-react"
import { format } from "date-fns"
import { auth } from "@/lib/auth"
import { canAccess } from "@/lib/permissions"
import { getSalesLedgerEntry } from "@/lib/data/ledger"
import { PageHeader } from "@/components/ui/page-header"
import { SalesPaymentStatusBadge } from "@/components/ui/badge"
import { SalesLedgerActions } from "@/components/ledger/SalesLedgerActions"
import { formatCurrency } from "@/lib/utils"
import { T } from "@/components/ui/T"
import type { Role } from "@/types"

export default async function SalesLedgerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!canAccess(session!.user.role as Role, "ledger", session!.user.modulePermissions)) redirect("/dashboard")
  const { id } = await params
  const companyId = session!.user.companyId as string

  const entry = await getSalesLedgerEntry(id, companyId)
  if (!entry) notFound()

  return (
    <div>
      <Link href="/ledger/sales" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft className="h-4 w-4" />
        <T k="backToSalesLedger" />
      </Link>

      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            {entry.orderNo ?? entry.id.slice(0, 8)}
            <SalesPaymentStatusBadge status={entry.paymentStatus} />
          </span>
        }
        subtitle={<span className="text-slate-400 text-xs">{format(new Date(entry.date), "dd MMM yyyy")}</span>}
        actions={<SalesLedgerActions entry={entry} />}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4"><T k="customer" /></h3>
            <div className="flex items-start gap-2 text-sm">
              <User className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
              <p className="font-medium text-slate-900">{entry.customerName}</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3"><T k="details" /></h3>
            <dl className="space-y-2 text-sm">
              {entry.invoice && (
                <div className="flex justify-between">
                  <dt className="text-slate-500"><T k="source" /></dt>
                  <dd>
                    <Link href={`/quotations/invoices/${entry.invoice.id}`} className="text-blue-600 hover:underline">
                      {entry.invoice.invoiceNumber}
                    </Link>
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-slate-500"><T k="createdBy" /></dt>
                <dd className="text-slate-700">{entry.createdBy.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500"><T k="date" /></dt>
                <dd className="text-slate-700">{format(new Date(entry.date), "dd MMM yyyy")}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3"><T k="costSummary" /></h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500"><T k="invoiceAmount" /></dt>
                <dd className="text-slate-700">{formatCurrency(entry.invoiceAmount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500"><T k="paidAmount" /></dt>
                <dd className="text-green-700">{formatCurrency(entry.amountReceived)}</dd>
              </div>
              <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2">
                <dt><T k="balance" /></dt>
                <dd className={entry.balance > 0 ? "text-red-700" : ""}>{formatCurrency(entry.balance)}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-slate-400" />
              <T k="paymentHistory" />
            </h3>
            {entry.paymentHistory.length === 0 ? (
              <p className="text-sm text-slate-400 italic py-4 text-center">
                <T k="noRecentRecords" />
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-100">
                      <th className="pb-2 text-left"><T k="date" /></th>
                      <th className="pb-2 text-left"><T k="reference" /></th>
                      <th className="pb-2 text-right"><T k="amount" /></th>
                      <th className="pb-2 text-right"><T k="createdBy" /></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {entry.paymentHistory.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2 text-slate-600 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-slate-300" />
                            {format(new Date(p.date), "dd MMM yyyy")}
                          </span>
                        </td>
                        <td className="py-2 text-slate-500">{p.referenceNo ?? "—"}</td>
                        <td className="py-2 text-right font-medium text-green-700">{formatCurrency(p.amount)}</td>
                        <td className="py-2 text-right text-slate-500">{p.createdBy.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {entry.remark && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-2"><T k="remark" /></h3>
              <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{entry.remark}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

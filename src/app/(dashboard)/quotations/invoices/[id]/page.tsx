import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft, User, Download, FileSpreadsheet, FileText, Package, Wallet, Cloud } from "lucide-react"
import { auth } from "@/lib/auth"
import { getInvoice, getInvoiceDropboxDocuments } from "@/lib/data/invoices"
import {
  canAccess,
  canEditInvoice,
  canDeleteInvoice,
  canConfirmInvoice,
  canCancelInvoice,
  canCreateSalesRecord,
} from "@/lib/permissions"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { InvoiceStatusBadge, SalesPaymentStatusBadge } from "@/components/ui/badge"
import { InvoiceActions } from "@/components/quotations/InvoiceActions"
import { InvoiceEtrCard } from "@/components/quotations/InvoiceEtrCard"
import { formatCurrency } from "@/lib/utils"
import { format } from "date-fns"
import { T } from "@/components/ui/T"
import type { Role } from "@/types"

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  const role = session!.user.role as Role
  const permissions = session!.user.modulePermissions as string[]
  if (!canAccess(role, "invoice", permissions)) redirect("/dashboard")
  const { id } = await params
  const companyId = session!.user.companyId as string

  const invoice = await getInvoice(id, companyId)
  if (!invoice) notFound()

  const dropboxDocuments = await getInvoiceDropboxDocuments(id, companyId)
  const pdfDoc = dropboxDocuments.find((d) => d.fileType === "PDF")
  const xlsxDoc = dropboxDocuments.find((d) => d.fileType === "XLSX")
  const etrDoc = dropboxDocuments.find((d) => d.fileType === "ETR")
  const pdfDownloadUrl = `/api/quotations/invoices/${id}/documents/pdf`
  const excelDownloadUrl = `/api/quotations/invoices/${id}/documents/xlsx`
  const needsDropboxSync = !pdfDoc || !xlsxDoc

  const subtotal = Number(invoice.subtotal)
  const vatPercent = Number(invoice.vatPercent)
  const vatAmount = Number(invoice.vatAmount)
  const totalAmount = Number(invoice.totalAmount)

  return (
    <div>
      <Link
        href="/quotations/invoices"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ChevronLeft className="h-4 w-4" />
        <T k="invoices" />
      </Link>

      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            {invoice.invoiceNumber}
            <InvoiceStatusBadge status={invoice.status} />
          </span>
        }
        subtitle={
          <span className="text-slate-400 text-xs">
            {format(new Date(invoice.date), "dd MMM yyyy")}
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <a href={pdfDownloadUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" icon={<Download className="h-3.5 w-3.5" />}>
                <T k="downloadPdf" />
              </Button>
            </a>
            <a href={excelDownloadUrl}>
              <Button variant="outline" size="sm" icon={<FileSpreadsheet className="h-3.5 w-3.5" />}>
                <T k="downloadExcel" />
              </Button>
            </a>
            <InvoiceActions
              invoiceId={invoice.id}
              status={invoice.status}
              salesLedgerEntryId={invoice.salesLedgerEntry?.id ?? null}
              canEdit={canEditInvoice(role, permissions)}
              canDelete={canDeleteInvoice(role, permissions)}
              canConfirm={canConfirmInvoice(role, permissions)}
              canCancel={canCancelInvoice(role, permissions)}
              canCreateSalesRecordPerm={canCreateSalesRecord(role, permissions)}
              needsDropboxSync={needsDropboxSync}
            />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left sidebar */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4"><T k="customer" /></h3>
            <div className="flex items-start gap-2 text-sm">
              <User className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-slate-900">{invoice.customer.companyName}</p>
                {invoice.customer.name && <p className="text-xs text-slate-500">{invoice.customer.name}</p>}
                <p className="text-xs text-slate-400"><T k="pinNumber" />: {invoice.customerPin || invoice.customer.pinNumber || "—"}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3"><T k="details" /></h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500"><T k="source" /></dt>
                <dd>
                  {invoice.quotation ? (
                    <Link href={`/quotations/${invoice.quotation.id}`} className="text-blue-600 hover:underline">
                      {invoice.quotation.quotationNumber}
                    </Link>
                  ) : (
                    <span className="text-slate-700"><T k="directInvoice" /></span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500"><T k="createdBy" /></dt>
                <dd className="text-slate-700">{invoice.createdBy.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500"><T k="date" /></dt>
                <dd className="text-slate-700">{format(new Date(invoice.date), "dd MMM yyyy")}</dd>
              </div>
            </dl>
          </div>

          {/* Dropbox sync state for the official PDF/Excel */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Cloud className="h-4 w-4 text-slate-400" />
              <T k="dropboxFiles" />
            </h3>
            {!pdfDoc && !xlsxDoc ? (
              <p className="text-sm text-slate-400 italic"><T k="notYetSyncedToDropbox" /></p>
            ) : (
              <>
                {needsDropboxSync && (
                  <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    {xlsxDoc ? <T k="invoicePdfConversionUnavailableBanner" /> : <T k="invoiceDropboxSyncFailedBanner" />}
                  </p>
                )}
                <div className="space-y-2 text-sm">
                  {[pdfDoc, xlsxDoc].filter((d): d is NonNullable<typeof d> => Boolean(d)).map((doc) => (
                    <div key={doc.id} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                      <p className="text-[11px] font-medium text-slate-500">{doc.fileType}</p>
                      <p className="truncate text-xs font-medium text-slate-900">{doc.dropboxFileName ?? "—"}</p>
                      <p className="truncate font-mono text-[10px] text-slate-400">{doc.dropboxPath ?? "—"}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <InvoiceEtrCard invoiceId={id} doc={etrDoc} canManage={canEditInvoice(role, permissions)} />

          {/* Sales Ledger linkage */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-slate-400" />
              <T k="salesLedgerLinkage" />
            </h3>
            {invoice.salesLedgerEntry ? (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500"><T k="paidAmount" /></dt>
                  <dd className="text-slate-700">{formatCurrency(Number(invoice.salesLedgerEntry.amountReceived))}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500"><T k="balance" /></dt>
                  <dd className="text-slate-700">{formatCurrency(Number(invoice.salesLedgerEntry.balance))}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500"><T k="paymentStatus" /></dt>
                  <dd><SalesPaymentStatusBadge status={invoice.salesLedgerEntry.paymentStatus} /></dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-slate-400 italic"><T k="notLinkedToSalesLedger" /></p>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Package className="h-4 w-4 text-slate-400" />
              <T k="invoiceItems" />
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-100">
                    <th className="pb-2 text-left"><T k="description" /></th>
                    <th className="pb-2 text-right"><T k="unit" /></th>
                    <th className="pb-2 text-right"><T k="quantity" /></th>
                    <th className="pb-2 text-right"><T k="unitPrice" /></th>
                    <th className="pb-2 text-right"><T k="amount" /></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {invoice.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2 text-slate-700">{item.description}</td>
                      <td className="py-2 text-right text-slate-500">{item.unit ?? "—"}</td>
                      <td className="py-2 text-right text-slate-600">{item.quantity}</td>
                      <td className="py-2 text-right text-slate-600">{formatCurrency(Number(item.unitPrice))}</td>
                      <td className="py-2 text-right font-medium text-slate-700">{formatCurrency(Number(item.amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4"><T k="costSummary" /></h3>
            <div className="max-w-sm ml-auto space-y-2 text-sm">
              <div className="flex justify-between text-slate-700">
                <span><T k="subtotal" /></span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span><T k="vat" /> ({vatPercent}%)</span>
                <span>{formatCurrency(vatAmount)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 text-base border-t border-slate-200 pt-2">
                <span><T k="total" /></span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-400" />
              <T k="receivedBy" />
            </h3>
            <div className="mt-3 h-8 w-64 border-b border-slate-300" />
          </div>
        </div>
      </div>
    </div>
  )
}

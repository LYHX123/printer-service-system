import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft, User, Download, FileSpreadsheet, FileText, Package, Cloud, Receipt } from "lucide-react"
import { auth } from "@/lib/auth"
import { getDelivery, getDeliveryDropboxDocuments } from "@/lib/data/deliveries"
import {
  canAccess,
  canEditDelivery,
  canDeleteDelivery,
  canConvertDeliveryToInvoice,
  canSyncDelivery,
  canViewQuotations,
  canViewInvoice,
} from "@/lib/permissions"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { DeliveryInvoiceStatusBadge, InvoiceStatusBadge } from "@/components/ui/badge"
import { DeliveryActions } from "@/components/delivery/DeliveryActions"
import { formatCurrency } from "@/lib/utils"
import { format } from "date-fns"
import type { Role } from "@/types"

export default async function DeliveryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const role = session!.user.role as Role
  const permissions = session!.user.modulePermissions as string[]
  if (!canAccess(role, "delivery", permissions)) redirect("/dashboard")
  const { id } = await params
  const companyId = session!.user.companyId as string

  const delivery = await getDelivery(id, companyId)
  if (!delivery) notFound()

  const dropboxDocuments = await getDeliveryDropboxDocuments(id, companyId)
  const pdfDoc = dropboxDocuments.find((d) => d.fileType === "PDF")
  const xlsxDoc = dropboxDocuments.find((d) => d.fileType === "XLSX")
  const pdfDownloadUrl = `/api/delivery/${id}/documents/pdf`
  const excelDownloadUrl = `/api/delivery/${id}/documents/xlsx`
  const needsDropboxSync = !pdfDoc || !xlsxDoc

  const canViewQuotationModule = canViewQuotations(role, permissions)
  const canViewInvoiceModule = canViewInvoice(role, permissions)

  return (
    <div>
      <Link href="/delivery" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft className="h-4 w-4" />
        Delivery
      </Link>

      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            {delivery.deliveryNumber}
            <DeliveryInvoiceStatusBadge invoiced={Boolean(delivery.invoice)} />
          </span>
        }
        subtitle={<span className="text-slate-400 text-xs">{format(new Date(delivery.deliveryDate), "dd MMM yyyy")}</span>}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <a href={pdfDownloadUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" icon={<Download className="h-3.5 w-3.5" />}>Download PDF</Button>
            </a>
            <a href={excelDownloadUrl}>
              <Button variant="outline" size="sm" icon={<FileSpreadsheet className="h-3.5 w-3.5" />}>Download Excel</Button>
            </a>
            <DeliveryActions
              deliveryId={delivery.id}
              invoice={delivery.invoice ? { id: delivery.invoice.id, invoiceNumber: delivery.invoice.invoiceNumber } : null}
              canEdit={canEditDelivery(role, permissions)}
              canDelete={canDeleteDelivery(role, permissions)}
              canConvertToInvoice={canConvertDeliveryToInvoice(role, permissions)}
              needsDropboxSync={needsDropboxSync}
              canSyncDropbox={canSyncDelivery(role, permissions)}
            />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left sidebar */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Customer</h3>
            <div className="flex items-start gap-2 text-sm">
              <User className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-slate-900">{delivery.customer.companyName}</p>
                {delivery.customer.name && <p className="text-xs text-slate-500">{delivery.customer.name}</p>}
                {delivery.customerBranch && <p className="text-xs text-slate-400">Project: {delivery.customerBranch.name}</p>}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Details</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Created By</dt>
                <dd className="text-slate-700">{delivery.createdBy.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Date</dt>
                <dd className="text-slate-700">{format(new Date(delivery.deliveryDate), "dd MMM yyyy")}</dd>
              </div>
              {delivery.reference && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Reference</dt>
                  <dd className="text-slate-700">{delivery.reference}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Source Quotation — hidden entirely for a user without Quotation
              module access, same "hide, never degrade" rule as Invoice Detail. */}
          {canViewQuotationModule && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-400" />
                Source Quotation
              </h3>
              {delivery.quotation ? (
                <Link href={`/quotations/${delivery.quotation.id}`} className="font-mono text-xs font-semibold text-blue-600 hover:underline">
                  {delivery.quotation.quotationNumber}
                </Link>
              ) : (
                <p className="text-sm text-slate-400 italic">Manual delivery — no source quotation.</p>
              )}
            </div>
          )}

          {/* Linked Invoice */}
          {canViewInvoiceModule && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Receipt className="h-4 w-4 text-slate-400" />
                Linked Invoice
              </h3>
              {delivery.invoice ? (
                <>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Invoice No.</dt>
                      <dd>
                        <Link href={`/quotations/invoices/${delivery.invoice.id}`} className="font-mono text-xs font-semibold text-blue-600 hover:underline">
                          {delivery.invoice.invoiceNumber}
                        </Link>
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Total</dt>
                      <dd className="text-slate-700">{formatCurrency(Number(delivery.invoice.totalAmount))}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500">Status</dt>
                      <dd><InvoiceStatusBadge status={delivery.invoice.status} /></dd>
                    </div>
                  </dl>
                  <Link href={`/quotations/invoices/${delivery.invoice.id}`} className="mt-3 block">
                    <Button variant="outline" size="sm" className="w-full">View Invoice</Button>
                  </Link>
                </>
              ) : (
                <p className="text-sm text-slate-400 italic">Not yet invoiced.</p>
              )}
            </div>
          )}

          {/* Dropbox sync state */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Cloud className="h-4 w-4 text-slate-400" />
              Dropbox Files
            </h3>
            {!pdfDoc && !xlsxDoc ? (
              <p className="text-sm text-slate-400 italic">
                {delivery.customer.shortName?.trim() ? "Not yet synced to Dropbox." : "Customer has no Short Name set — required for Dropbox sync."}
              </p>
            ) : (
              <div className="space-y-2 text-sm">
                {[pdfDoc, xlsxDoc].filter((d): d is NonNullable<typeof d> => Boolean(d)).map((doc) => (
                  <div key={doc.id} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                    <p className="text-[11px] font-medium text-slate-500">{doc.fileType}</p>
                    <p className="truncate text-xs font-medium text-slate-900">{doc.dropboxFileName ?? "—"}</p>
                    <p className="truncate font-mono text-[10px] text-slate-400">{doc.dropboxPath ?? "—"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Package className="h-4 w-4 text-slate-400" />
              Delivery Items
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-100">
                    <th className="pb-2 text-left">Item</th>
                    <th className="pb-2 text-right">Unit</th>
                    <th className="pb-2 text-right">Quantity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {delivery.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2 text-slate-700">{item.description}</td>
                      <td className="py-2 text-right text-slate-500">{item.unitSnapshot ?? item.part?.unit ?? "—"}</td>
                      <td className="py-2 text-right text-slate-600">{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-400" />
              Received By
            </h3>
            <div className="mt-3 h-8 w-64 border-b border-slate-300" />
          </div>
        </div>
      </div>
    </div>
  )
}

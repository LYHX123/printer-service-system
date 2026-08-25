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
import { isCapacitorAppRequest } from "@/lib/platform/app-mode"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { DeliveryInvoiceStatusBadge, InvoiceStatusBadge } from "@/components/ui/badge"
import { DeliveryActions } from "@/components/delivery/DeliveryActions"
import { T } from "@/components/ui/T"
import { AppDetailSection } from "@/components/app-ui/AppDetailSection"
import { AppDetailRow } from "@/components/app-ui/AppDetailRow"
import { AppMoneyValue } from "@/components/app-ui/AppMoneyValue"
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
  const isAppMode = await isCapacitorAppRequest()

  if (isAppMode) {
    return (
      <div className="space-y-4">
        <Link href="/delivery" className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 active:text-slate-800">
          <ChevronLeft className="h-4 w-4" />
          <T k="delivery" />
        </Link>

        <AppDetailSection>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-sm font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
              {delivery.deliveryNumber}
            </span>
            <DeliveryInvoiceStatusBadge invoiced={Boolean(delivery.invoice)} />
          </div>
          <div className="mt-3 space-y-0.5">
            <AppDetailRow label={<T k="customer" />} value={delivery.customer.companyName} />
            {delivery.customer.name && <AppDetailRow label={<T k="mainContactName" />} value={delivery.customer.name} />}
            {delivery.customerBranch && <AppDetailRow label={<T k="projectLabel" />} value={delivery.customerBranch.name} />}
            <AppDetailRow label={<T k="date" />} value={format(new Date(delivery.deliveryDate), "dd MMM yyyy")} />
            <AppDetailRow label={<T k="createdBy" />} value={delivery.createdBy.name} />
            {delivery.reference && <AppDetailRow label={<T k="reference" />} value={delivery.reference} />}
            {canViewQuotationModule && (
              <AppDetailRow
                label={<T k="sourceQuotationLabel" />}
                value={
                  delivery.quotation ? (
                    <Link href={`/quotations/${delivery.quotation.id}`} className="font-mono text-xs font-semibold text-blue-600">
                      {delivery.quotation.quotationNumber}
                    </Link>
                  ) : (
                    <span className="text-xs italic text-slate-400"><T k="manualDeliveryNoQuotation" /></span>
                  )
                }
              />
            )}
          </div>
        </AppDetailSection>

        <AppDetailSection title={<T k="deliveryItemsHeading" />}>
          <div className="divide-y divide-slate-100">
            {delivery.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <span className="min-w-0 truncate text-sm text-slate-800">{item.description}</span>
                <span className="shrink-0 text-xs text-slate-500">
                  {item.quantity} {item.unitSnapshot ?? item.part?.unit ?? ""}
                </span>
              </div>
            ))}
          </div>
        </AppDetailSection>

        {canViewInvoiceModule && (
          <AppDetailSection title={<T k="linkedInvoiceHeading" />}>
            {delivery.invoice ? (
              <>
                <AppDetailRow
                  label={<T k="invoiceNoLabel" />}
                  value={
                    <Link href={`/quotations/invoices/${delivery.invoice.id}`} className="font-mono text-xs font-semibold text-blue-600">
                      {delivery.invoice.invoiceNumber}
                    </Link>
                  }
                />
                <AppDetailRow label={<T k="total" />} value={<AppMoneyValue amount={Number(delivery.invoice.totalAmount)} />} />
                <AppDetailRow label={<T k="status" />} value={<InvoiceStatusBadge status={delivery.invoice.status} />} />
              </>
            ) : (
              <p className="text-sm italic text-slate-400"><T k="notYetInvoiced" /></p>
            )}
          </AppDetailSection>
        )}

        <AppDetailSection title={<T k="dropboxFiles" />}>
          {!pdfDoc && !xlsxDoc ? (
            <p className="text-sm italic text-slate-400">
              <T k={delivery.customer.shortName?.trim() ? "notYetSyncedToDropbox" : "customerShortNameRequiredForDeliverySync"} />
            </p>
          ) : (
            <div className="space-y-2">
              {[pdfDoc, xlsxDoc].filter((d): d is NonNullable<typeof d> => Boolean(d)).map((doc) => (
                <div key={doc.id} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                  <p className="text-[11px] font-medium text-slate-500">{doc.fileType}</p>
                  <p className="truncate text-xs font-medium text-slate-900">{doc.dropboxFileName ?? "—"}</p>
                </div>
              ))}
            </div>
          )}
        </AppDetailSection>

        <AppDetailSection title={<T k="documents" />}>
          <div className="flex gap-2">
            <a href={pdfDownloadUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
              <Button size="sm" icon={<Download className="h-3.5 w-3.5" />} className="w-full"><T k="downloadPdf" /></Button>
            </a>
            <a href={excelDownloadUrl} className="flex-1">
              <Button variant="outline" size="sm" icon={<FileSpreadsheet className="h-3.5 w-3.5" />} className="w-full"><T k="downloadExcel" /></Button>
            </a>
          </div>
        </AppDetailSection>

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
    )
  }

  return (
    <div>
      <Link href="/delivery" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft className="h-4 w-4" />
        <T k="delivery" />
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
              <Button size="sm" icon={<Download className="h-3.5 w-3.5" />}><T k="downloadPdf" /></Button>
            </a>
            <a href={excelDownloadUrl}>
              <Button variant="outline" size="sm" icon={<FileSpreadsheet className="h-3.5 w-3.5" />}><T k="downloadExcel" /></Button>
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
            <h3 className="text-sm font-semibold text-slate-900 mb-4"><T k="customer" /></h3>
            <div className="flex items-start gap-2 text-sm">
              <User className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-slate-900">{delivery.customer.companyName}</p>
                {delivery.customer.name && <p className="text-xs text-slate-500">{delivery.customer.name}</p>}
                {delivery.customerBranch && (
                  <p className="text-xs text-slate-400">
                    <T k="projectLabel" />: {delivery.customerBranch.name}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3"><T k="details" /></h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500"><T k="createdBy" /></dt>
                <dd className="text-slate-700">{delivery.createdBy.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500"><T k="date" /></dt>
                <dd className="text-slate-700">{format(new Date(delivery.deliveryDate), "dd MMM yyyy")}</dd>
              </div>
              {delivery.reference && (
                <div className="flex justify-between">
                  <dt className="text-slate-500"><T k="reference" /></dt>
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
                <T k="sourceQuotationLabel" />
              </h3>
              {delivery.quotation ? (
                <Link href={`/quotations/${delivery.quotation.id}`} className="font-mono text-xs font-semibold text-blue-600 hover:underline">
                  {delivery.quotation.quotationNumber}
                </Link>
              ) : (
                <p className="text-sm text-slate-400 italic"><T k="manualDeliveryNoQuotation" /></p>
              )}
            </div>
          )}

          {/* Linked Invoice */}
          {canViewInvoiceModule && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Receipt className="h-4 w-4 text-slate-400" />
                <T k="linkedInvoiceHeading" />
              </h3>
              {delivery.invoice ? (
                <>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-slate-500"><T k="invoiceNoLabel" /></dt>
                      <dd>
                        <Link href={`/quotations/invoices/${delivery.invoice.id}`} className="font-mono text-xs font-semibold text-blue-600 hover:underline">
                          {delivery.invoice.invoiceNumber}
                        </Link>
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500"><T k="total" /></dt>
                      <dd className="text-slate-700">{formatCurrency(Number(delivery.invoice.totalAmount))}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500"><T k="status" /></dt>
                      <dd><InvoiceStatusBadge status={delivery.invoice.status} /></dd>
                    </div>
                  </dl>
                  <Link href={`/quotations/invoices/${delivery.invoice.id}`} className="mt-3 block">
                    <Button variant="outline" size="sm" className="w-full"><T k="viewInvoice" /></Button>
                  </Link>
                </>
              ) : (
                <p className="text-sm text-slate-400 italic"><T k="notYetInvoiced" /></p>
              )}
            </div>
          )}

          {/* Dropbox sync state */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Cloud className="h-4 w-4 text-slate-400" />
              <T k="dropboxFiles" />
            </h3>
            {!pdfDoc && !xlsxDoc ? (
              <p className="text-sm text-slate-400 italic">
                <T k={delivery.customer.shortName?.trim() ? "notYetSyncedToDropbox" : "customerShortNameRequiredForDeliverySync"} />
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
              <T k="deliveryItemsHeading" />
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-100">
                    <th className="pb-2 text-left"><T k="itemColumnLabel" /></th>
                    <th className="pb-2 text-right"><T k="unit" /></th>
                    <th className="pb-2 text-right"><T k="quantity" /></th>
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
              <T k="receivedBy" />
            </h3>
            <div className="mt-3 h-8 w-64 border-b border-slate-300" />
          </div>
        </div>
      </div>
    </div>
  )
}

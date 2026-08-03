import Link from "next/link"
import Image from "next/image"
import { notFound, redirect } from "next/navigation"
import {
  ChevronLeft, User, ImageOff,
  Package, Briefcase, FileText, Receipt, Cloud, History,
} from "lucide-react"
import { auth } from "@/lib/auth"
import { getQuotation, getQuotationDropboxDocuments, getQuotationVersionSnapshot } from "@/lib/data/quotations"
import { canAccess, canConvertQuotationToInvoice, canExportQuotation } from "@/lib/permissions"
import { PageHeader } from "@/components/ui/page-header"
import { QuotationStatusBadge } from "@/components/ui/badge"
import { QuotationActions } from "@/components/quotations/QuotationActions"
import { QuotationVersionSelector } from "@/components/quotations/QuotationVersionSelector"
import { formatCurrency } from "@/lib/utils"
import { format } from "date-fns"
import { T } from "@/components/ui/T"
import type { QuotationDetail, QuotationDropboxDocumentItem } from "@/lib/data/quotations"

interface DisplayItem {
  id: string
  imageUrl: string | null
  brand: string | null
  name: string | null
  partNumber: string | null
  description: string | null
  quantity: number
  unitPrice: number
  subtotal: number
}

interface DisplayData {
  customer: { id: string; companyName: string; pinNumber: string | null; name: string | null; phone: string | null }
  contactName: string | null
  contactPhone: string | null
  subtotal: number
  vatPercent: number
  totalCost: number
  remarks: string | null
  internalNotes: string | null
  validUntil: Date | string | null
  items: DisplayItem[]
}

function liveToDisplay(quotation: QuotationDetail): DisplayData {
  return {
    customer: quotation.customer,
    contactName: quotation.contactName,
    contactPhone: quotation.contactPhone,
    subtotal: Number(quotation.subtotal),
    vatPercent: Number(quotation.vatPercent),
    totalCost: Number(quotation.totalCost),
    remarks: quotation.remarks,
    internalNotes: quotation.internalNotes,
    validUntil: quotation.validUntil,
    items: quotation.items.map((item) => ({
      id: item.id,
      imageUrl: item.part?.imageUrl ?? null,
      brand: item.part?.brand ?? null,
      name: item.part?.name ?? null,
      partNumber: item.part?.partNumber ?? null,
      description: item.description,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      subtotal: Number(item.subtotal),
    })),
  }
}

export default async function QuotationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ version?: string; view?: string }>
}) {
  const session = await auth()
  const role = session!.user.role as import("@/types").Role
  if (!canAccess(role, "quotations", session!.user.modulePermissions)) redirect("/dashboard")
  const { id } = await params
  const sp = await searchParams
  const companyId = session!.user.companyId as string

  const quotation = await getQuotation(id, companyId)
  if (!quotation) notFound()

  const dropboxDocuments = await getQuotationDropboxDocuments(id, companyId)
  const hasFinal = dropboxDocuments.some((d) => d.isFinal)

  // ─── Resolve which version this page load is showing ────────────────────
  // Query params (?version=N / ?view=final) rather than local state, so the
  // viewed version survives a refresh or a shared link. With no params at
  // all: an Approved quotation defaults to FINAL (the authoritative
  // document), everything else defaults to its current version.
  const versionParam = sp.version ? Number(sp.version) : null
  let viewMode: "current" | "historical" | "final"
  if (sp.view === "final") {
    viewMode = "final"
  } else if (versionParam) {
    viewMode = versionParam === quotation.currentVersion ? "current" : "historical"
  } else {
    viewMode = quotation.status === "APPROVED" ? "final" : "current"
  }

  const finalDoc = dropboxDocuments.find((d) => d.isFinal)
  const viewedVersionNumber =
    viewMode === "final" ? (finalDoc?.version ?? quotation.currentVersion) : viewMode === "current" ? quotation.currentVersion : versionParam!

  // ─── Business data for the version being viewed ──────────────────────────
  // "current" always reads the quotation's live row (it IS the current
  // data). "historical"/"final" read that version's immutable snapshot —
  // never the live row, which may have moved on since. A quotation Adjusted
  // before this feature existed has no snapshot for its older versions; that
  // shows a clear "unavailable" message rather than ever substituting today's
  // data mislabeled as an old one.
  const snapshot = viewMode === "current" ? null : await getQuotationVersionSnapshot(id, companyId, viewedVersionNumber)
  const snapshotUnavailable = viewMode !== "current" && !snapshot
  const display: DisplayData = viewMode === "current" || !snapshot ? liveToDisplay(quotation) : snapshot

  // ─── Version-aware Download links ────────────────────────────────────────
  function findDoc(fileType: "PDF" | "XLSX"): QuotationDropboxDocumentItem | undefined {
    if (viewMode === "final") return dropboxDocuments.find((d) => d.isFinal && d.fileType === fileType)
    return dropboxDocuments.find((d) => !d.isFinal && d.version === viewedVersionNumber && d.fileType === fileType)
  }
  const pdfDoc = findDoc("PDF")
  const xlsxDoc = findDoc("XLSX")
  const pdfDownloadUrl = pdfDoc
    ? `/api/quotations/${id}/documents/version/${pdfDoc.id}`
    : viewMode === "current"
      ? `/api/quotations/${id}/documents/pdf`
      : null
  const excelDownloadUrl = xlsxDoc
    ? `/api/quotations/${id}/documents/version/${xlsxDoc.id}`
    : viewMode === "current"
      ? `/api/quotations/${id}/documents/xlsx`
      : null

  // ─── Dropbox sync status for whatever's being viewed (current or final; never historical — that button is hidden) ───
  const targetDocs =
    viewMode === "final"
      ? dropboxDocuments.filter((d) => d.isFinal)
      : dropboxDocuments.filter((d) => !d.isFinal && d.version === quotation.currentVersion)
  const targetXlsxSynced = targetDocs.some((d) => d.fileType === "XLSX")
  const targetPdfSynced = targetDocs.some((d) => d.fileType === "PDF")
  const needsDropboxSync = viewMode !== "historical" && (!targetXlsxSynced || !targetPdfSynced)

  // Group the flat, already-ordered (FINAL first, then version desc) document
  // list into one card per (version, isFinal) — each heading links to that
  // version, doubling as a version-history entry point.
  const dropboxVersionGroups: { key: string; label: string; href: string; docs: typeof dropboxDocuments }[] = []
  for (const doc of dropboxDocuments) {
    const key = doc.isFinal ? "FINAL" : `V${doc.version}`
    let group = dropboxVersionGroups.find((g) => g.key === key)
    if (!group) {
      const label = doc.isFinal
        ? "FINAL — Approved"
        : `Version ${doc.version}${doc.version === quotation.currentVersion ? " — Current" : ""}`
      const href = doc.isFinal ? `/quotations/${id}?view=final` : `/quotations/${id}?version=${doc.version}`
      group = { key, label, href, docs: [] }
      dropboxVersionGroups.push(group)
    }
    group.docs.push(doc)
  }

  const vatAmount = (display.subtotal * display.vatPercent) / 100

  return (
    <div>
      <Link
        href="/quotations"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ChevronLeft className="h-4 w-4" />
        <T k="quotations" />
      </Link>

      <PageHeader
        title={
          <span className="flex items-center gap-3 flex-wrap">
            {quotation.quotationNumber}
            <QuotationVersionSelector
              quotationId={id}
              currentVersion={quotation.currentVersion}
              hasFinal={hasFinal}
              value={viewMode === "final" ? "final" : viewedVersionNumber}
            />
          </span>
        }
        subtitle={
          <span className="flex items-center gap-2 flex-wrap">
            <QuotationStatusBadge status={quotation.status} />
            {viewMode === "historical" && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                VERSION {viewedVersionNumber} — <T k="historical" />
              </span>
            )}
            {viewMode === "final" && (
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                FINAL — Approved · Based on Version {viewedVersionNumber}
              </span>
            )}
            <span className="text-slate-400 text-xs">
              {format(new Date(quotation.createdAt), "dd MMM yyyy")}
            </span>
            {display.validUntil && (
              <span className="text-slate-400 text-xs">
                <T k="validUntil" /> {format(new Date(display.validUntil), "dd MMM yyyy")}
              </span>
            )}
          </span>
        }
        actions={
          <QuotationActions
            quotationId={quotation.id}
            status={quotation.status}
            role={role}
            existingInvoice={quotation.invoice ? { id: quotation.invoice.id, invoiceNumber: quotation.invoice.invoiceNumber } : null}
            canConvertToInvoice={canConvertQuotationToInvoice(role, session!.user.modulePermissions)}
            customerPin={quotation.customer.pinNumber ?? ""}
            defaultVatPercent={Number(quotation.vatPercent)}
            needsDropboxSync={needsDropboxSync}
            canSyncDropbox={canExportQuotation(role, session!.user.modulePermissions)}
            viewMode={viewMode}
            syncTargetVersion={viewMode === "current" ? quotation.currentVersion : undefined}
            pdfDownloadUrl={pdfDownloadUrl}
            excelDownloadUrl={excelDownloadUrl}
          />
        }
      />

      {/* Converted-to-job banner */}
      {quotation.convertedJob && (
        <div className="mb-4 flex items-center gap-3 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
          <Briefcase className="h-4 w-4 text-green-600 shrink-0" />
          <span className="text-sm text-green-800">
            <T k="convertedToJob" />{" "}
            <Link
              href={`/jobs/${quotation.convertedJob.id}`}
              className="font-semibold text-green-700 hover:underline"
            >
              {quotation.convertedJob.jobNumber}
            </Link>
          </span>
        </div>
      )}

      {viewMode !== "current" && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
          <span className="flex items-center gap-2 text-sm text-slate-600">
            <History className="h-4 w-4 text-slate-400 shrink-0" />
            {viewMode === "final" ? (
              <>Viewing the FINAL, Approved document (based on Version {viewedVersionNumber}).</>
            ) : (
              <>Viewing Version {viewedVersionNumber} — a read-only historical snapshot.</>
            )}
          </span>
          <Link href={`/quotations/${id}`} className="shrink-0 text-sm font-medium text-blue-600 hover:underline">
            <T k="backToCurrentVersion" />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left sidebar */}
        <div className="space-y-4">
          {/* Customer info */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4"><T k="customer" /></h3>
            {snapshotUnavailable ? (
              <p className="text-sm text-slate-400 italic"><T k="historicalDataUnavailable" /></p>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <Link
                      href={`/customers/${display.customer.id}/edit`}
                      className="font-medium text-slate-900 hover:text-blue-600 transition-colors"
                    >
                      {display.customer.companyName}
                    </Link>
                    {(display.contactName ?? display.customer.name) && (
                      <p className="text-xs text-slate-500">{display.contactName ?? display.customer.name}</p>
                    )}
                    {display.contactPhone && (
                      <p className="text-xs text-slate-400">{display.contactPhone}</p>
                    )}
                    {display.customer.pinNumber && (
                      <p className="text-xs text-slate-400"><T k="pinNumber" />: {display.customer.pinNumber}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3"><T k="details" /></h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500"><T k="createdBy" /></dt>
                <dd className="text-slate-700">{quotation.createdBy.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Quotation Date</dt>
                <dd className="text-slate-700">{format(new Date(quotation.createdAt), "dd MMM yyyy")}</dd>
              </div>
              {quotation.approvedAt && (
                <div className="flex justify-between">
                  <dt className="text-slate-500"><T k="approved" /></dt>
                  <dd className="text-slate-700">{format(new Date(quotation.approvedAt), "dd MMM yyyy")}</dd>
                </div>
              )}
              {display.validUntil && (
                <div className="flex justify-between">
                  <dt className="text-slate-500"><T k="validUntil" /></dt>
                  <dd className="text-slate-700">{format(new Date(display.validUntil), "dd MMM yyyy")}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Dropbox sync state for the official PDF/Excel — one block per archived version, newest/FINAL first */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Cloud className="h-4 w-4 text-slate-400" />
              <T k="dropboxFiles" />
            </h3>

            {dropboxDocuments.length === 0 ? (
              <p className="text-sm text-slate-400 italic">
                {quotation.customer.shortName?.trim() ? <T k="notYetSyncedToDropbox" /> : <T k="quotationShortNameRequiredForSync" />}
              </p>
            ) : (
              <>
                {needsDropboxSync && quotation.customer.shortName?.trim() && (
                  <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    {targetXlsxSynced ? <T k="pdfConversionUnavailableBanner" /> : <T k="dropboxSyncFailedBanner" />}
                  </p>
                )}
                <div className="space-y-4 text-sm">
                  {dropboxVersionGroups.map((group) => (
                    <div key={group.key}>
                      <Link
                        href={group.href}
                        className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-blue-600 hover:underline"
                      >
                        {group.label}
                      </Link>
                      <div className="space-y-2">
                        {group.docs.map((doc) => (
                          <div key={doc.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                            <div className="min-w-0">
                              <p className="text-[11px] font-medium text-slate-500">{doc.fileType}</p>
                              <p className="truncate text-xs font-medium text-slate-900">{doc.dropboxFileName ?? "—"}</p>
                              <p className="truncate font-mono text-[10px] text-slate-400">{doc.dropboxPath ?? "—"}</p>
                            </div>
                            {doc.dropboxPath && (
                              <a
                                href={`/api/quotations/${id}/documents/version/${doc.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 text-xs font-medium text-blue-600 hover:underline"
                              >
                                <T k="download" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Invoice generated from this quotation (at most one) */}
          {quotation.invoice && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Receipt className="h-4 w-4 text-slate-400" />
                <T k="invoices" />
              </h3>
              <div className="flex items-center justify-between text-sm">
                <Link
                  href={`/quotations/invoices/${quotation.invoice.id}`}
                  className="font-mono text-xs font-semibold text-blue-600 hover:underline"
                >
                  {quotation.invoice.invoiceNumber}
                </Link>
                <span className="text-xs text-slate-500">{format(new Date(quotation.invoice.date), "dd MMM yyyy")}</span>
              </div>
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Line items */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Package className="h-4 w-4 text-slate-400" />
              Quotation Items
            </h3>
            {snapshotUnavailable ? (
              <p className="text-sm text-slate-400 italic"><T k="historicalDataUnavailable" /></p>
            ) : display.items.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No items added yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-100">
                      <th className="pb-2 text-left">Item</th>
                      <th className="pb-2 text-right"><T k="quantity" /></th>
                      <th className="pb-2 text-right"><T k="unitPrice" /></th>
                      <th className="pb-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {display.items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2 text-slate-700">
                          <div className="flex items-center gap-2">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                              {item.imageUrl ? (
                                <Image src={item.imageUrl} alt={item.name ?? ""} width={36} height={36} className="h-full w-full object-cover" unoptimized />
                              ) : (
                                <ImageOff className="h-3.5 w-3.5 text-slate-300" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">
                                {item.name ? (item.brand ? `${item.brand} — ${item.name}` : item.name) : item.description}
                              </p>
                              {item.partNumber && <p className="text-xs text-slate-400 font-mono">{item.partNumber}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="py-2 text-right text-slate-600">{item.quantity}</td>
                        <td className="py-2 text-right text-slate-600">{formatCurrency(item.unitPrice)}</td>
                        <td className="py-2 text-right font-medium text-slate-700">{formatCurrency(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Cost summary */}
          {!snapshotUnavailable && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4"><T k="costSummary" /></h3>
              <div className="max-w-sm ml-auto space-y-2 text-sm">
                <div className="flex justify-between text-slate-700">
                  <span><T k="subtotal" /></span>
                  <span>{formatCurrency(display.subtotal)}</span>
                </div>
                {display.vatPercent > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span><T k="vat" /> ({display.vatPercent}%)</span>
                    <span>{formatCurrency(vatAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-slate-900 text-base border-t border-slate-200 pt-2">
                  <span><T k="total" /></span>
                  <span>{formatCurrency(display.totalCost)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Remarks */}
          {!snapshotUnavailable && display.remarks && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-400" />
                <T k="remarks" />
              </h3>
              <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{display.remarks}</p>
            </div>
          )}

          {/* Internal notes */}
          {!snapshotUnavailable && display.internalNotes && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-5">
              <h3 className="text-xs font-semibold text-amber-700 mb-2 uppercase tracking-wide">
                <T k="internalNotes" />
              </h3>
              <p className="text-sm text-amber-900 whitespace-pre-line leading-relaxed">{display.internalNotes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

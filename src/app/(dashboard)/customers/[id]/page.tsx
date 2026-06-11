import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft, Plus, Pencil, Phone, Mail, MapPin } from "lucide-react"
import { auth } from "@/lib/auth"
import { getCustomer } from "@/lib/data/customers"
import { getCommunicationLogs } from "@/lib/data/communications"
import { getCompanySettings } from "@/lib/data/settings"
import { canSendCommunications } from "@/lib/permissions"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Tabs } from "@/components/ui/tabs"
import { StatusBadge, PriorityBadge, EquipmentTypeBadge, QuotationStatusBadge, ChannelBadge, MessageTypeBadge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { BranchesTab } from "@/components/customers/BranchesTab"
import { SendMessageButton } from "@/components/communications/SendMessageButton"
import { T } from "@/components/ui/T"
import { formatCurrency } from "@/lib/utils"
import { SERVICE_TYPE_LABELS } from "@/types"
import { format } from "date-fns"

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const session = await auth()
  const { id } = await params
  const { tab = "overview" } = await searchParams
  const companyId = session!.user.companyId as string
  const role = session!.user.role as import("@/types").Role

  const customer = await getCustomer(id, companyId)
  if (!customer) notFound()

  const [communications, company] = await Promise.all([
    getCommunicationLogs(id, companyId),
    getCompanySettings(companyId),
  ])

  const canSend = canSendCommunications(role)
  const templateVariables = {
    customer: customer.name,
    companyName: company?.name ?? "",
    companyPhone: company?.phone ?? "",
  }

  const tabs = [
    { id: "overview", label: <T k="overview" /> },
    { id: "branches", label: <T k="branches" />, count: customer.branches.length },
    { id: "equipment", label: <T k="equipment" />, count: customer.equipment.length },
    { id: "jobs", label: <T k="jobs" />, count: customer.serviceJobs.length },
    { id: "quotations", label: <T k="quotations" />, count: customer.quotations.length },
    { id: "communications", label: <T k="communications" />, count: communications.length },
  ]

  return (
    <div>
      <Link href="/customers" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft className="h-4 w-4" />
        <T k="customers" />
      </Link>

      <PageHeader
        title={customer.name}
        subtitle={customer.companyName ?? customer.code}
        actions={
          <div className="flex flex-wrap gap-2">
            {canSend && (
              <>
                <SendMessageButton
                  channel="WHATSAPP"
                  messageType="GENERAL"
                  label="WhatsApp"
                  customerId={customer.id}
                  recipient={customer.phone}
                  variables={templateVariables}
                />
                <SendMessageButton
                  channel="EMAIL"
                  messageType="GENERAL"
                  label="Email"
                  customerId={customer.id}
                  recipient={customer.email}
                  variables={templateVariables}
                />
              </>
            )}
            <Link href={`/equipment/new?customerId=${customer.id}`}>
              <Button variant="secondary" size="sm" icon={<Plus className="h-3.5 w-3.5" />}>
                <T k="registerEquipment" />
              </Button>
            </Link>
            <Link href={`/quotations/new?customerId=${customer.id}`}>
              <Button variant="secondary" size="sm" icon={<Plus className="h-3.5 w-3.5" />}>
                <T k="newQuotation" />
              </Button>
            </Link>
            <Link href={`/jobs/new?customerId=${customer.id}`}>
              <Button variant="secondary" size="sm" icon={<Plus className="h-3.5 w-3.5" />}>
                <T k="newJob" />
              </Button>
            </Link>
            <Link href={`/customers/${id}/edit`}>
              <Button variant="outline" size="sm" icon={<Pencil className="h-3.5 w-3.5" />}>
                <T k="edit" />
              </Button>
            </Link>
          </div>
        }
      />

      {/* Tabs */}
      <div className="mb-6">
        <Tabs tabs={tabs} activeTab={tab} pathPrefix={`/customers/${id}`} />
      </div>

      {/* Overview tab */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4"><T k="contactInformation" /></h3>
              <dl className="space-y-3">
                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <dt className="text-xs text-slate-500"><T k="phone" /></dt>
                    <dd className="text-sm text-slate-900">{customer.phone}</dd>
                  </div>
                </div>
                {customer.email && (
                  <div className="flex items-start gap-3">
                    <Mail className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <dt className="text-xs text-slate-500"><T k="email" /></dt>
                      <dd className="text-sm text-slate-900">{customer.email}</dd>
                    </div>
                  </div>
                )}
                {customer.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <dt className="text-xs text-slate-500"><T k="address" /></dt>
                      <dd className="text-sm text-slate-900 whitespace-pre-line">{customer.address}</dd>
                    </div>
                  </div>
                )}
              </dl>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4"><T k="summary" /></h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500"><T k="customerCode" /></span>
                  <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{customer.code}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500"><T k="equipment" /></span>
                  <span className="text-sm font-semibold text-slate-900">{customer.equipment.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500"><T k="totalJobs" /></span>
                  <span className="text-sm font-semibold text-slate-900">{customer.serviceJobs.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500"><T k="branches" /></span>
                  <span className="text-sm font-semibold text-slate-900">{customer.branches.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500"><T k="registered" /></span>
                  <span className="text-xs text-slate-600">{format(new Date(customer.createdAt), "dd MMM yyyy")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Branches tab */}
      {tab === "branches" && (
        <BranchesTab customerId={id} branches={customer.branches} />
      )}

      {/* Equipment tab */}
      {tab === "equipment" && (
        <div>
          {customer.equipment.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white">
              <EmptyState
                title={<T k="noEquipmentRegistered" />}
                description={<T k="registerEquipmentDesc" />}
                action={{ label: <T k="registerEquipment" />, onClick: () => {} }}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    {[<T key="type" k="type" />, <span key="brandModel"><T k="brand" /> / <T k="model" /></span>, <T key="serialNumber" k="serialNumber" />, <T key="branch" k="branch" />, ""].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customer.equipment.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <EquipmentTypeBadge type={e.type} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-sm text-slate-900">{e.brand}</span>
                        <span className="text-sm text-slate-500 ml-1">{e.model}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{e.serialNumber}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{e.branch?.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Link href={`/equipment/${e.id}`} className="text-xs text-blue-600 hover:underline"><T k="view" /> →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Jobs tab */}
      {tab === "jobs" && (
        <div>
          {customer.serviceJobs.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white">
              <EmptyState
                title={<T k="noServiceJobs" />}
                description={<T k="createJobForCustomerDesc" />}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    {[<T key="jobNumber" k="jobNumber" />, <T key="equipment" k="equipment" />, <T key="serviceType" k="serviceType" />, <T key="status" k="status" />, <T key="priority" k="priority" />, <T key="date" k="date" />, ""].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customer.serviceJobs.map((j) => (
                    <tr key={j.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{j.jobNumber}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{j.equipment.brand} {j.equipment.model}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{j.serviceType}</td>
                      <td className="px-4 py-3"><StatusBadge status={j.status} /></td>
                      <td className="px-4 py-3"><PriorityBadge priority={j.priority} /></td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{format(new Date(j.receivedDate), "dd MMM yyyy")}</td>
                      <td className="px-4 py-3">
                        <Link href={`/jobs/${j.id}`} className="text-xs text-blue-600 hover:underline"><T k="view" /> →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Quotations tab */}
      {tab === "quotations" && (
        <div>
          <div className="flex justify-end mb-3">
            <Link href={`/quotations/new?customerId=${id}`}>
              <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />}><T k="newQuotation" /></Button>
            </Link>
          </div>
          {customer.quotations.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white">
              <EmptyState
                title={<T k="noQuotations" />}
                description={<T k="createQuotationDesc" />}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    {[<T key="quotationNumber" k="quotationNumber" />, <T key="equipment" k="equipment" />, <T key="serviceType" k="serviceType" />, <T key="total" k="total" />, <T key="status" k="status" />, <T key="date" k="date" />, ""].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customer.quotations.map((q) => (
                    <tr key={q.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{q.quotationNumber}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {q.equipment ? `${q.equipment.brand} ${q.equipment.model}` : <span className="text-slate-400 italic">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{SERVICE_TYPE_LABELS[q.serviceType]}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">{formatCurrency(Number(q.totalCost))}</td>
                      <td className="px-4 py-3"><QuotationStatusBadge status={q.status} /></td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{format(new Date(q.createdAt), "dd MMM yyyy")}</td>
                      <td className="px-4 py-3">
                        <Link href={`/quotations/${q.id}`} className="text-xs text-blue-600 hover:underline"><T k="view" /> →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Communications tab */}
      {tab === "communications" && (
        <div>
          {communications.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white">
              <EmptyState
                title={<T k="noCommunicationHistory" />}
                description={<T k="communicationHistoryDesc" />}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    {[<T key="date" k="date" />, <T key="channel" k="channel" />, <T key="messageType" k="messageType" />, <T key="recipient" k="recipient" />, <T key="status" k="status" />, <T key="createdBy" k="createdBy" />].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {communications.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{format(new Date(c.createdAt), "dd MMM yyyy HH:mm")}</td>
                      <td className="px-4 py-3"><ChannelBadge channel={c.channel} /></td>
                      <td className="px-4 py-3"><MessageTypeBadge messageType={c.messageType} /></td>
                      <td className="px-4 py-3 text-sm text-slate-600">{c.recipient}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{c.status}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{c.createdBy.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

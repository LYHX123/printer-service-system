/**
 * Turns one AuditLog row into a human-readable one-line summary for the
 * Settings > Audit Log list. Pure and defensive: metadata is untyped JSON
 * that may be null, missing expected keys, or carry values written by an
 * older/removed code path — every accessor below falls back gracefully
 * rather than throwing, and any (entityType, action) pair this function
 * doesn't specifically recognize still renders a readable generic line
 * instead of an error.
 */

interface AuditSummaryInput {
  entityType: string
  action: string
  entityId: string
  metadata: Record<string, unknown> | null
  performedByName: string
}

function str(metadata: Record<string, unknown> | null, key: string): string | undefined {
  const v = metadata?.[key]
  return typeof v === "string" && v.length > 0 ? v : undefined
}

function num(metadata: Record<string, unknown> | null, key: string): number | undefined {
  const v = metadata?.[key]
  return typeof v === "number" ? v : undefined
}

function list(metadata: Record<string, unknown> | null, key: string): string[] {
  const v = metadata?.[key]
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []
}

/** "SalesLedgerEntry" -> "Sales Ledger Entry", "ShopAccountEntry" -> "Shop Account Entry" */
function humanizeEntityType(entityType: string): string {
  return entityType.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
}

/** "STATUS_CHANGED" -> "status changed" */
function humanizeAction(action: string): string {
  return action.toLowerCase().replace(/_/g, " ")
}

type Formatter = (m: Record<string, unknown> | null, who: string, id: string) => string

const FORMATTERS: Record<string, Formatter> = {
  "Customer:CREATED": (m, who) => `${who} created customer ${str(m, "companyName") ?? ""}`.trim(),
  "Customer:UPDATED": (m, who) => `${who} updated customer ${str(m, "companyName") ?? ""}`.trim(),
  "Customer:REACTIVATED": (m, who) => `${who} reactivated customer ${str(m, "companyName") ?? ""}`.trim(),
  "Customer:DEACTIVATED": (m, who) => `${who} deactivated customer ${str(m, "companyName") ?? ""}`.trim(),

  "CustomerBranch:CREATED": (m, who) => `${who} added project ${str(m, "name") ?? ""}`.trim(),
  "CustomerBranch:UPDATED": (m, who) => `${who} updated project ${str(m, "name") ?? ""}`.trim(),
  "CustomerBranch:REACTIVATED": (m, who) => `${who} reactivated a project`,
  "CustomerBranch:DEACTIVATED": (m, who) => `${who} deactivated a project`,

  "CustomerDocument:UPLOADED": (m, who) => `${who} uploaded document ${str(m, "fileName") ?? ""}`.trim(),
  "CustomerDocument:REPLACED": (m, who) => `${who} replaced document ${str(m, "fileName") ?? ""}`.trim(),
  "CustomerDocument:DELETED": (m, who) => `${who} deleted document ${str(m, "fileName") ?? ""}`.trim(),

  "Stock:CREATED": (m, who) => `${who} added stock item ${str(m, "name") ?? ""}`.trim(),
  "Stock:UPDATED": (m, who) => `${who} updated stock item ${str(m, "name") ?? ""}`.trim(),
  "Stock:ADJUSTED": (m, who) => {
    const type = str(m, "movementType")
    const qty = num(m, "quantity")
    const name = str(m, "name") ?? ""
    return `${who} recorded a ${type ?? "stock"} movement${qty !== undefined ? ` of ${qty}` : ""} for ${name}`.trim()
  },
  "Stock:REACTIVATED": (m, who) => `${who} reactivated stock item ${str(m, "name") ?? ""}`.trim(),
  "Stock:DEACTIVATED": (m, who) => `${who} deactivated stock item ${str(m, "name") ?? ""}`.trim(),

  "Quotation:CREATED": (m, who) => `${who} created quotation ${str(m, "quotationNumber") ?? ""}`.trim(),
  "Quotation:ADJUSTED": (m, who) => {
    const from = num(m, "fromVersion")
    const to = num(m, "toVersion")
    const number = str(m, "quotationNumber") ?? ""
    return `${who} adjusted quotation ${number}${from !== undefined && to !== undefined ? ` (v${from} -> v${to})` : ""}`.trim()
  },
  "Quotation:CUSTOMER_CHANGED": (_m, who) => `${who} changed the customer on a quotation`,
  "Quotation:PROJECT_CHANGED": (_m, who) => `${who} changed the project on a quotation`,
  "Quotation:STATUS_CHANGED": (m, who) => {
    const from = str(m, "from")
    const to = str(m, "to")
    return `${who} changed a quotation's status${from && to ? ` from ${from} to ${to}` : ""}`
  },
  "Quotation:APPROVED": (m, who) => {
    const v = num(m, "approvedFromVersion")
    return `${who} approved a quotation${v !== undefined ? ` (v${v})` : ""}`
  },
  "Quotation:DELETED": (m, who) => `${who} deleted quotation ${str(m, "quotationNumber") ?? ""}`.trim(),
  "Quotation:DROPBOX_RESYNCED": (m, who) => `${who} re-synced quotation ${str(m, "quotationNumber") ?? ""} to Dropbox`.trim(),

  "Invoice:CREATED": (m, who) => `${who} created invoice ${str(m, "invoiceNumber") ?? ""}`.trim(),
  "Invoice:UPDATED": (m, who) => `${who} updated invoice ${str(m, "invoiceNumber") ?? ""}`.trim(),
  "Invoice:DELETED": (m, who) => `${who} deleted invoice ${str(m, "invoiceNumber") ?? ""}`.trim(),
  "Invoice:CONFIRMED": (m, who) => `${who} confirmed invoice ${str(m, "invoiceNumber") ?? ""}`.trim(),
  "Invoice:CANCELLED": (m, who) => `${who} cancelled invoice ${str(m, "invoiceNumber") ?? ""}`.trim(),
  "Invoice:DROPBOX_RESYNCED": (m, who) => `${who} re-synced invoice ${str(m, "invoiceNumber") ?? ""} to Dropbox`.trim(),

  "InvoiceDocument:UPLOADED": (m, who) => `${who} uploaded ETR ${str(m, "fileName") ?? ""}`.trim(),
  "InvoiceDocument:REPLACED": (m, who) => `${who} replaced ETR ${str(m, "fileName") ?? ""}`.trim(),
  "InvoiceDocument:REMOVED": (m, who) => `${who} deleted ETR ${str(m, "fileName") ?? ""}`.trim(),

  "LedgerEntry:CREATED": (m, who) => `${who} added a ${(str(m, "type") ?? "").toLowerCase()} ledger entry`.trim(),
  "LedgerEntry:UPDATED": (m, who) => `${who} updated a ledger entry`,
  "LedgerEntry:DELETED": (m, who) => `${who} deleted a ledger entry`,

  "SalesLedgerEntry:CREATED": (m, who) => `${who} created sales ledger record for ${str(m, "customerName") ?? ""}`.trim(),
  "SalesLedgerEntry:UPDATED": (m, who) => `${who} updated sales ledger record for ${str(m, "customerName") ?? ""}`.trim(),
  "SalesLedgerEntry:ARCHIVED": (m, who) => `${who} archived a sales ledger record`,
  "SalesLedgerEntry:REACTIVATED": (m, who) => `${who} restored a sales ledger record from archive`,

  "ShopAccountEntry:CREATED": (m, who) => `${who} added a shop account ${(str(m, "type") ?? "").toLowerCase()} entry`.trim(),
  "ShopAccountEntry:UPDATED": (m, who) => `${who} updated a shop account entry`,
  "ShopAccountEntry:DELETED": (m, who) => `${who} deleted a shop account entry`,

  "Task:CREATED": (m, who) => `${who} created task ${str(m, "title") ?? ""}`.trim(),
  "Task:DELETED": (m, who) => `${who} deleted task ${str(m, "title") ?? ""}`.trim(),
  "Task:STATUS_CHANGED": (m, who) => `${who} marked task ${str(m, "title") ?? ""} as ${str(m, "toStatus") ?? "updated"}`.trim(),
  "Task:PARTICIPANT_ADDED": (m, who) => `${who} added ${str(m, "participantName") ?? "a participant"} to a task`,
  "Task:PARTICIPANT_REMOVED": (m, who) => `${who} removed ${str(m, "participantName") ?? "a participant"} from a task`,

  "TaskStep:CREATED": (m, who) => `${who} added a progress step: ${str(m, "title") ?? ""}`.trim(),
  "TaskStep:TASK_NODE_UPDATED": (_m, who) => `${who} updated a task progress step`,
  "TaskStep:TASK_NODE_DELETED": (m, who) => `${who} deleted progress step ${str(m, "title") ?? ""}`.trim(),

  "User:CREATED": (m, who) => `${who} created user ${str(m, "name") ?? ""} (${str(m, "role") ?? ""})`.trim(),
  "User:UPDATED": (m, who) => `${who} updated ${str(m, "name") ?? "a user"}'s profile`,
  "User:ROLE_CHANGED": (m, who) => {
    const name = str(m, "name") ?? "a user"
    const from = str(m, "from")
    const to = str(m, "to")
    return `${who} changed ${name}'s role${from && to ? ` from ${from} to ${to}` : ""}`
  },
  "User:REACTIVATED": (m, who) => `${who} reactivated user ${str(m, "name") ?? ""}`.trim(),
  "User:DEACTIVATED": (m, who) => `${who} deactivated user ${str(m, "name") ?? ""}`.trim(),
  "User:PERMISSIONS_UPDATED": (m, who) => {
    const name = str(m, "name") ?? "a user"
    const added = list(m, "addedPermissions").length
    const removed = list(m, "removedPermissions").length
    const parts = [added > 0 ? `+${added}` : null, removed > 0 ? `-${removed}` : null].filter(Boolean)
    return `${who} updated ${name}'s permissions${parts.length > 0 ? ` (${parts.join(", ")})` : ""}`
  },
  "User:PASSWORD_RESET": (m, who) => `${who} reset the password for ${str(m, "name") ?? "a user"}`,

  "SystemInitialization:SYSTEM_INITIALIZED": (m, who) => {
    const modules = list(m, "effectiveModules")
    return `${who} ran System Initialization${modules.length > 0 ? ` (${modules.join(", ")})` : ""}`
  },

  "DropboxConnection:DROPBOX_CONNECTED": (m, who) => `${who} connected Dropbox account ${str(m, "accountName") ?? ""}`.trim(),
  "DropboxConnection:DROPBOX_FOLDERS_INITIALIZED": (_m, who) => `${who} initialized Dropbox folders`,
  "DropboxConnection:DROPBOX_DISCONNECTED": (_m, who) => `${who} disconnected Dropbox`,
  "DropboxConnection:DROPBOX_CONNECTION_TESTED": (_m, who) => `${who} tested the Dropbox connection`,
}

export function formatAuditSummary(entry: AuditSummaryInput): string {
  const key = `${entry.entityType}:${entry.action}`
  const formatter = FORMATTERS[key]
  const who = entry.performedByName
  if (formatter) {
    try {
      return formatter(entry.metadata, who, entry.entityId)
    } catch {
      // Fall through to the generic line below — a malformed/unexpected
      // metadata shape must never break the Audit Log page.
    }
  }
  return `${who} — ${humanizeAction(entry.action)} (${humanizeEntityType(entry.entityType)})`
}

import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/generated/prisma/client"

/**
 * Standard action verbs, matching the past-tense convention already used by
 * every existing call site (CustomerBranch, Task participants, System
 * Initialization, ...). Not a closed enum — logActivity still accepts any
 * string, since old rows (and a few entity-specific verbs like
 * CUSTOMER_CHANGED/PARTICIPANT_ADDED) predate this list. New call sites
 * should prefer one of these where it fits, to keep the Audit Log UI's
 * formatter able to recognize most rows without a fallback.
 */
export const AUDIT_ACTIONS = {
  CREATED: "CREATED",
  UPDATED: "UPDATED",
  DELETED: "DELETED",
  APPROVED: "APPROVED",
  ADJUSTED: "ADJUSTED",
  UPLOADED: "UPLOADED",
  REPLACED: "REPLACED",
  REMOVED: "REMOVED",
  ARCHIVED: "ARCHIVED",
  REACTIVATED: "REACTIVATED",
  DEACTIVATED: "DEACTIVATED",
  CONFIRMED: "CONFIRMED",
  CANCELLED: "CANCELLED",
  STATUS_CHANGED: "STATUS_CHANGED",
  ROLE_CHANGED: "ROLE_CHANGED",
  PERMISSIONS_UPDATED: "PERMISSIONS_UPDATED",
  PASSWORD_RESET: "PASSWORD_RESET",
  DROPBOX_RESYNCED: "DROPBOX_RESYNCED",
} as const

/**
 * Stable entityType names for the modules instrumented in this round. Kept
 * separate from the DropboxConnection/TaskStep/CustomerDocument/CustomerBranch
 * values already written by earlier phases — those are left exactly as-is.
 */
export const AUDIT_ENTITY_TYPES = {
  CUSTOMER: "Customer",
  STOCK: "Stock",
  QUOTATION: "Quotation",
  INVOICE: "Invoice",
  INVOICE_DOCUMENT: "InvoiceDocument",
  LEDGER_ENTRY: "LedgerEntry",
  SALES_LEDGER_ENTRY: "SalesLedgerEntry",
  SHOP_ACCOUNT_ENTRY: "ShopAccountEntry",
  TASK: "Task",
  TASK_STEP: "TaskStep",
  USER: "User",
  SYSTEM_INITIALIZATION: "SystemInitialization",
} as const

interface LogActivityParams {
  companyId: string
  entityType: string
  entityId: string
  action: string
  performedById: string
  metadata?: Record<string, unknown>
}

/**
 * Fire-and-forget activity log write. Never throws — a logging failure must
 * never roll back or block the mutation it's describing.
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        ...params,
        metadata: params.metadata as Prisma.InputJsonValue | undefined,
      },
    })
  } catch (err) {
    console.error("logActivity failed:", err)
  }
}

import { prisma } from "@/lib/prisma"
import {
  hasAnyPermission,
  canViewCustomers,
  canViewQuotations,
  canViewStock,
  canViewLedgerBook,
  canViewTask,
} from "@/lib/permissions"
import { categoryToBucket } from "@/lib/stock-types"
import type { Role } from "@/types"

export interface UploadRequester {
  id: string
  role: Role
  companyId: string
  modulePermissions: string[]
}

export type UploadAuthResult =
  | { allowed: true }
  /** "denied" = same company but missing the relevant permission (403). "not_found" = unknown path, cross-company, or the record doesn't exist (404) — deliberately the same outcome for both, so a response can never reveal whether another company's file exists. */
  | { allowed: false; reason: "denied" | "not_found" }

const ALLOW: UploadAuthResult = { allowed: true }
const DENY: UploadAuthResult = { allowed: false, reason: "denied" }
const NOT_FOUND: UploadAuthResult = { allowed: false, reason: "not_found" }

/**
 * Centralized authorization resolver for every file reachable through
 * src/app/uploads/[...path]/route.ts. Classifies the path against the
 * fixed namespaces every local-storage writer in src/lib/uploads.ts and
 * src/lib/storage/localStorageProvider.ts actually uses, resolves the
 * owning DB record, and checks company ownership + the same module
 * permission that already gates viewing that record everywhere else in
 * the app. Any path that doesn't match a known, resolvable pattern is
 * denied — this must fail closed, never fail open.
 */
export async function authorizeUploadAccess(
  segments: string[],
  user: UploadRequester
): Promise<UploadAuthResult> {
  const [seg0, seg1, seg2] = segments

  // jobs/<jobId>/photos/... and jobs/<jobId>/signature/... — the legacy Jobs
  // module has been decommissioned (Final Remediation Phase 5). Historical
  // ServiceJob/JobPhoto rows and their files on disk are deliberately kept
  // (no data deleted), but the file-access surface itself must be closed
  // along with every other Jobs entry point — this used to resolve the
  // owning job and apply the Engineer-assigned-job rule; it now denies
  // unconditionally, before any DB lookup, for every role including ADMIN.
  // NOT_FOUND (not DENY) so a response never reveals whether a given legacy
  // job file exists, same non-disclosure rule as every other branch below.
  if (seg0 === "jobs") {
    return NOT_FOUND
  }

  // companies/<companyId>/logo.png — company branding, visible to any
  // authenticated member of that company (not gated behind settings.edit,
  // which only guards *changing* it — see CompanySettingsForm/logo route).
  if (seg0 === "companies" && seg1) {
    return seg1 === user.companyId ? ALLOW : NOT_FOUND
  }

  // spareparts/<partId>/image.jpg
  if (seg0 === "spareparts" && seg1) {
    const part = await prisma.sparePart.findUnique({
      where: { id: seg1 },
      select: { companyId: true, category: true },
    })
    if (!part || part.companyId !== user.companyId) return NOT_FOUND
    return canViewStock(user.role, user.modulePermissions, categoryToBucket(part.category)) ? ALLOW : DENY
  }

  // quotations/items/<quotationItemId>/picture.jpg
  if (seg0 === "quotations" && seg1 === "items" && seg2) {
    const item = await prisma.quotationItem.findUnique({
      where: { id: seg2 },
      select: { quotation: { select: { companyId: true } } },
    })
    if (!item || item.quotation.companyId !== user.companyId) return NOT_FOUND
    return canViewQuotations(user.role, user.modulePermissions) ? ALLOW : DENY
  }

  // tasks/steps/<stepId>/<file>.jpg
  if (seg0 === "tasks" && seg1 === "steps" && seg2) {
    const step = await prisma.taskStep.findUnique({
      where: { id: seg2 },
      select: {
        task: {
          select: { companyId: true, createdById: true, participants: { select: { userId: true } } },
        },
      },
    })
    if (!step || step.task.companyId !== user.companyId) return NOT_FOUND
    if (!hasAnyPermission(user.role, user.modulePermissions, "tasks.")) return DENY
    return canViewTask(user.role, user.id, step.task) ? ALLOW : DENY
  }

  // shop-account/<shopAccountEntryId>/<file>
  if (seg0 === "shop-account" && seg1) {
    const entry = await prisma.shopAccountEntry.findUnique({
      where: { id: seg1 },
      select: { companyId: true },
    })
    if (!entry || entry.companyId !== user.companyId) return NOT_FOUND
    return canViewLedgerBook(user.role, user.modulePermissions, "shop") ? ALLOW : DENY
  }

  // Everything else: the only other writer is the generic LocalStorageProvider,
  // used for legacy (pre-Dropbox) Customer Documents with `scopePath:
  // customer.shortName` — i.e. a root-level "<shortName>/<file>" path with no
  // fixed keyword prefix. Rather than guess whether segment[0] "looks like" a
  // short name, resolve it the unambiguous way: storageKey is exactly
  // segments.join("/"), so look up the exact row.
  const storageKey = segments.join("/")
  const doc = await prisma.customerDocument.findFirst({
    where: { storageProvider: "LOCAL", storageKey },
    select: { companyId: true },
  })
  if (doc) {
    if (doc.companyId !== user.companyId) return NOT_FOUND
    return canViewCustomers(user.role, user.modulePermissions) ? ALLOW : DENY
  }

  // Unknown path — fail closed.
  return NOT_FOUND
}

"use server"

import type { RepairReportInput } from "@/lib/schemas"

/**
 * The legacy Jobs module has been decommissioned — see Final Remediation
 * Phase 5 (Legacy Jobs Decommission). This export is kept only because the
 * (now-unreachable, since /jobs/[id]/report returns notFound()) legacy
 * RepairReportForm component still imports it by name — it is now a pure
 * no-op: no session read, no database access, no mutation, regardless of
 * caller, session state, or arguments. This was previously the subject of
 * a confirmed P1 (missing Engineer-assigned-job ownership check); rather
 * than patch that individually, the entire legacy Jobs mutation surface —
 * including this action — is being retired.
 */
export async function saveRepairReport(jobId: string, data: RepairReportInput) {
  void jobId
  void data
  return { error: "This feature is no longer available." }
}

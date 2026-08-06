"use server"

import type {
  JobInput,
  StatusUpdateInput,
  AssignEngineerInput,
  TechnicianNotesInput,
} from "@/lib/schemas"

/**
 * The legacy Jobs module has been decommissioned — see Final Remediation
 * Phase 5 (Legacy Jobs Decommission). Every export below is kept only
 * because the (now-unreachable, since every /jobs/** page returns
 * notFound()) legacy Jobs UI components still import them by name — each
 * one is now a pure no-op: no session read, no database access, no
 * mutation, regardless of caller, session state, or arguments (the
 * parameters themselves are only kept for call-site type compatibility;
 * `void`-ing them is intentional, not an oversight). This is intentional
 * retirement of the whole mutation surface, not a partial fix.
 */
const JOBS_DECOMMISSIONED = { error: "This feature is no longer available." } as const

export async function createJob(data: JobInput) {
  void data
  return JOBS_DECOMMISSIONED
}

export async function updateJobStatus(jobId: string, data: StatusUpdateInput) {
  void jobId
  void data
  return JOBS_DECOMMISSIONED
}

export async function assignEngineer(jobId: string, data: AssignEngineerInput) {
  void jobId
  void data
  return JOBS_DECOMMISSIONED
}

export async function updateTechnicianNotes(jobId: string, data: TechnicianNotesInput) {
  void jobId
  void data
  return JOBS_DECOMMISSIONED
}

export async function saveJobSignature(jobId: string, dataUrl: string) {
  void jobId
  void dataUrl
  return JOBS_DECOMMISSIONED
}

export async function declineSignature(jobId: string, note: string) {
  void jobId
  void note
  return JOBS_DECOMMISSIONED
}

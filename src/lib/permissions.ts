import type { Role } from "@/types"

/**
 * Centralized RBAC permission model for Phase 7.
 *
 * Role summary:
 * - ADMIN: full access to everything.
 * - MANAGER: customers, equipment, jobs, quotations, reports, inventory — no user/settings management.
 * - ENGINEER: assigned jobs, equipment details, photo/signature uploads, job status updates —
 *   no quotations, no inventory, no reports.
 * - RECEPTIONIST: customers, equipment, create/view jobs, create quotations —
 *   no reports, no inventory, no user management.
 */

export type Module =
  | "dashboard"
  | "customers"
  | "equipment"
  | "jobs"
  | "quotations"
  | "reports"
  | "inventory"
  | "users"
  | "settings"

const MODULE_ACCESS: Record<Module, Role[]> = {
  dashboard: ["ADMIN", "MANAGER", "ENGINEER", "RECEPTIONIST"],
  customers: ["ADMIN", "MANAGER", "RECEPTIONIST"],
  equipment: ["ADMIN", "MANAGER", "ENGINEER", "RECEPTIONIST"],
  jobs: ["ADMIN", "MANAGER", "ENGINEER", "RECEPTIONIST"],
  quotations: ["ADMIN", "MANAGER", "RECEPTIONIST"],
  reports: ["ADMIN", "MANAGER"],
  inventory: ["ADMIN", "MANAGER"],
  users: ["ADMIN"],
  settings: ["ADMIN"],
}

/** Whether a role can access a given module/section at all. */
export function canAccess(role: Role, module: Module): boolean {
  return MODULE_ACCESS[module].includes(role)
}

/** Receptionist & above can create jobs; Engineer can only update jobs assigned to them. */
export function canCreateJob(role: Role): boolean {
  return role === "ADMIN" || role === "MANAGER" || role === "RECEPTIONIST"
}

/** Engineers see only jobs assigned to them; other roles see all company jobs. */
export function isRestrictedToAssignedJobs(role: Role): boolean {
  return role === "ENGINEER"
}

/** Admin, Manager and Receptionist can create quotations. */
export function canCreateQuotation(role: Role): boolean {
  return role === "ADMIN" || role === "MANAGER" || role === "RECEPTIONIST"
}

/** Engineers (and above) can update job status, upload photos and signatures. */
export function canUpdateJobStatus(role: Role): boolean {
  return role === "ADMIN" || role === "MANAGER" || role === "ENGINEER"
}

export function canUploadJobMedia(role: Role): boolean {
  return role === "ADMIN" || role === "MANAGER" || role === "ENGINEER"
}

/** Only Admin manages users and company settings. */
export function canManageUsers(role: Role): boolean {
  return role === "ADMIN"
}

export function canManageSettings(role: Role): boolean {
  return role === "ADMIN"
}

/** Admin and Manager can manage inventory (spare parts, purchase orders). */
export function canManageInventory(role: Role): boolean {
  return canAccess(role, "inventory")
}

/** Admin and Manager can view reports. */
export function canViewReports(role: Role): boolean {
  return canAccess(role, "reports")
}

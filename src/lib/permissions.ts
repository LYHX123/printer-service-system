import type { Role } from "@/types"

/**
 * Centralized RBAC permission model for Phase 7.
 *
 * Per explicit request, all edit/manage permissions below are open to every
 * role (ADMIN, MANAGER, ENGINEER, RECEPTIONIST) across every module,
 * including Users and Settings. The only remaining role-specific behavior is
 * `isRestrictedToAssignedJobs`, which scopes the Jobs *list* for Engineers to
 * jobs assigned to them — that's a data-visibility scope, not an edit gate,
 * and was left as-is since it wasn't part of the "open all edit permissions"
 * request.
 */

export type Module =
  | "dashboard"
  | "customers"
  | "equipment"
  | "jobs"
  | "quotations"
  | "reports"
  | "productivity"
  | "inventory"
  | "users"
  | "settings"

const MODULE_ACCESS: Record<Module, Role[]> = {
  dashboard: ["ADMIN", "MANAGER", "ENGINEER", "RECEPTIONIST"],
  customers: ["ADMIN", "MANAGER", "ENGINEER", "RECEPTIONIST"],
  equipment: ["ADMIN", "MANAGER", "ENGINEER", "RECEPTIONIST"],
  jobs: ["ADMIN", "MANAGER", "ENGINEER", "RECEPTIONIST"],
  quotations: ["ADMIN", "MANAGER", "ENGINEER", "RECEPTIONIST"],
  reports: ["ADMIN", "MANAGER", "ENGINEER", "RECEPTIONIST"],
  productivity: ["ADMIN", "MANAGER", "ENGINEER", "RECEPTIONIST"],
  inventory: ["ADMIN", "MANAGER", "ENGINEER", "RECEPTIONIST"],
  users: ["ADMIN", "MANAGER", "ENGINEER", "RECEPTIONIST"],
  settings: ["ADMIN", "MANAGER", "ENGINEER", "RECEPTIONIST"],
}

/** Whether a role can access a given module/section at all. */
export function canAccess(role: Role, module: Module): boolean {
  return MODULE_ACCESS[module].includes(role)
}

/** Opened to all roles. */
export function canCreateJob(_role: Role): boolean {
  return true
}

/** Engineers see only jobs assigned to them; other roles see all company jobs. */
export function isRestrictedToAssignedJobs(role: Role): boolean {
  return role === "ENGINEER"
}

/** Opened to all roles. */
export function canCreateQuotation(_role: Role): boolean {
  return true
}

/** Opened to all roles. */
export function canUpdateJobStatus(_role: Role): boolean {
  return true
}

/** Opened to all roles. */
export function canUploadJobMedia(_role: Role): boolean {
  return true
}

/** Opened to all roles. */
export function canManageUsers(_role: Role): boolean {
  return true
}

/** Opened to all roles. */
export function canManageSettings(_role: Role): boolean {
  return true
}

/** Opened to all roles — manage inventory (spare parts, purchase orders, stock transactions). */
export function canManageInventory(_role: Role): boolean {
  return true
}

/** Alias for clarity at call sites that gate edit/create/delete actions. */
export const canEditInventory = canManageInventory

/** Opened to all roles. */
export function canViewReports(_role: Role): boolean {
  return true
}

/** Opened to all roles. */
export function canViewAllProductivity(_role: Role): boolean {
  return true
}

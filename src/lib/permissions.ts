import type { Role } from "@/types"

export type Module =
  | "dashboard"
  | "customers"
  | "jobs"
  | "quotations"
  | "inventory"
  | "ledger"
  | "users"
  | "settings"

export const ALL_MODULES: Module[] = [
  "dashboard",
  "quotations",
  "customers",
  "jobs",
  "inventory",
  "ledger",
  "users",
  "settings",
]

export const MODULE_LABELS: Record<Module, { en: string; zh: string }> = {
  dashboard:  { en: "Dashboard",   zh: "仪表盘" },
  quotations: { en: "Quotations",  zh: "报价单" },
  customers:  { en: "Customers",   zh: "客户"   },
  jobs:       { en: "Jobs",        zh: "工单"   },
  inventory:  { en: "Stock",       zh: "库存"   },
  ledger:     { en: "Ledger",      zh: "台账"   },
  users:      { en: "Users",       zh: "用户"   },
  settings:   { en: "Settings",    zh: "设置"   },
}

// Modules an Admin can never remove from their own account
export const ADMIN_SELF_PROTECTED: Module[] = ["dashboard", "users", "settings"]

/**
 * Core permission check.
 * - ADMIN role → always true
 * - empty permissions array → true (backward compat; existing users get full access)
 * - otherwise → explicit allowlist check
 */
export function hasModuleAccess(role: Role, module: Module, permissions: string[]): boolean {
  if (role === "ADMIN") return true
  if (permissions.length === 0) return true
  return permissions.includes(module)
}

/** Whether a role+permissions combo can view a module. Existing callers omit permissions and get full access. */
export function canAccess(role: Role, module: Module, permissions: string[] = []): boolean {
  return hasModuleAccess(role, module, permissions)
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

/** Opened to all roles — manage the Ledger module (income/expense book, sales ledger). */
export function canManageLedger(_role: Role): boolean {
  return true
}

import type { Role } from "@/types"

// ─── Hierarchical permission strings ───────────────────────────────────────────
// Replaces the old flat `Module` allowlist. `User.modulePermissions` (a plain
// Postgres string[] column) now stores an explicit, flattened list of leaf
// permission keys — e.g. checking the "Stock" parent checkbox in the UI just
// expands to all `stock.equipment.*`/`stock.consumption.*`/`stock.parts.*` leaves
// rather than storing a wildcard. `jobs` is kept as a single legacy key (the
// ServiceJob module predates this restructure and isn't part of this upgrade —
// it's also not linked from the sidebar today).

export type PermissionKey =
  | "dashboard.view"
  | "customers.view" | "customers.create" | "customers.edit" | "customers.delete" | "customers.files.upload"
  | "quotations.view" | "quotations.create" | "quotations.edit" | "quotations.delete" | "quotations.export" | "quotations.convertToInvoice"
  | "invoice.view" | "invoice.create" | "invoice.edit" | "invoice.delete" | "invoice.confirm" | "invoice.cancel" | "invoice.createSalesRecord"
  | "stock.equipment.view" | "stock.equipment.create" | "stock.equipment.edit" | "stock.equipment.delete" | "stock.equipment.adjust"
  | "stock.consumption.view" | "stock.consumption.create" | "stock.consumption.edit" | "stock.consumption.delete" | "stock.consumption.adjust"
  | "stock.parts.view" | "stock.parts.create" | "stock.parts.edit" | "stock.parts.delete" | "stock.parts.adjust"
  | "ledger.general.view" | "ledger.general.create" | "ledger.general.edit" | "ledger.general.delete" | "ledger.general.export"
  | "ledger.sales.view" | "ledger.sales.create" | "ledger.sales.edit" | "ledger.sales.delete" | "ledger.sales.export"
  | "ledger.shop.view" | "ledger.shop.create" | "ledger.shop.edit" | "ledger.shop.delete" | "ledger.shop.export"
  | "ledger.receipts.allocate"
  | "tasks.view" | "tasks.create" | "tasks.editOwn" | "tasks.editAll" | "tasks.delete"
  | "tasks.nodes.create" | "tasks.nodes.edit" | "tasks.nodes.delete"
  | "users.view" | "users.create" | "users.edit" | "users.delete" | "users.permissions.manage"
  | "settings.view" | "settings.edit"
  | "jobs" // legacy, unrestructured

interface PermLeaf {
  key: PermissionKey
  en: string
  zh: string
}

interface PermNode {
  key: string // prefix used for parent checkbox / nav gating, not itself a storable leaf
  en: string
  zh: string
  leaves?: PermLeaf[]
  children?: PermNode[]
}

// Drives both the nested PermissionsEditor UI and (via `collectLeaves`) the
// full "select all" default list for new users.
export const PERMISSION_TREE: PermNode[] = [
  { key: "dashboard", en: "Dashboard", zh: "仪表盘", leaves: [{ key: "dashboard.view", en: "View", zh: "查看" }] },
  {
    key: "customers", en: "Customers", zh: "客户",
    leaves: [
      { key: "customers.view", en: "View", zh: "查看" },
      { key: "customers.create", en: "Create", zh: "新建" },
      { key: "customers.edit", en: "Edit", zh: "编辑" },
      { key: "customers.delete", en: "Delete", zh: "删除" },
      { key: "customers.files.upload", en: "Upload Files", zh: "上传文件" },
    ],
  },
  {
    key: "quotations", en: "Quotations", zh: "报价单",
    leaves: [
      { key: "quotations.view", en: "View", zh: "查看" },
      { key: "quotations.create", en: "Create", zh: "新建" },
      { key: "quotations.edit", en: "Edit", zh: "编辑" },
      { key: "quotations.delete", en: "Delete", zh: "删除" },
      { key: "quotations.export", en: "Export", zh: "导出" },
      { key: "quotations.convertToInvoice", en: "Convert to Invoice", zh: "生成发票" },
    ],
  },
  {
    key: "invoice", en: "Invoice", zh: "发票",
    leaves: [
      { key: "invoice.view", en: "View", zh: "查看" },
      { key: "invoice.create", en: "Create", zh: "新建" },
      { key: "invoice.edit", en: "Edit", zh: "编辑" },
      { key: "invoice.delete", en: "Delete", zh: "删除" },
      { key: "invoice.confirm", en: "Confirm", zh: "确认" },
      { key: "invoice.cancel", en: "Cancel", zh: "取消" },
      { key: "invoice.createSalesRecord", en: "Create Sales Record", zh: "加入销售台账" },
    ],
  },
  {
    key: "stock", en: "Stock", zh: "库存",
    children: [
      {
        key: "stock.equipment", en: "Equipment", zh: "设备",
        leaves: [
          { key: "stock.equipment.view", en: "View", zh: "查看" },
          { key: "stock.equipment.create", en: "Create", zh: "新建" },
          { key: "stock.equipment.edit", en: "Edit", zh: "编辑" },
          { key: "stock.equipment.delete", en: "Delete", zh: "删除" },
          { key: "stock.equipment.adjust", en: "Adjust Quantity", zh: "调整数量" },
        ],
      },
      {
        key: "stock.consumption", en: "Consumption", zh: "耗材",
        leaves: [
          { key: "stock.consumption.view", en: "View", zh: "查看" },
          { key: "stock.consumption.create", en: "Create", zh: "新建" },
          { key: "stock.consumption.edit", en: "Edit", zh: "编辑" },
          { key: "stock.consumption.delete", en: "Delete", zh: "删除" },
          { key: "stock.consumption.adjust", en: "Adjust Quantity", zh: "调整数量" },
        ],
      },
      {
        key: "stock.parts", en: "Parts", zh: "零件",
        leaves: [
          { key: "stock.parts.view", en: "View", zh: "查看" },
          { key: "stock.parts.create", en: "Create", zh: "新建" },
          { key: "stock.parts.edit", en: "Edit", zh: "编辑" },
          { key: "stock.parts.delete", en: "Delete", zh: "删除" },
          { key: "stock.parts.adjust", en: "Adjust Quantity", zh: "调整数量" },
        ],
      },
    ],
  },
  {
    key: "ledger", en: "Ledger", zh: "台账",
    children: [
      {
        key: "ledger.general", en: "General Ledger", zh: "总账",
        leaves: [
          { key: "ledger.general.view", en: "View", zh: "查看" },
          { key: "ledger.general.create", en: "Create", zh: "新建" },
          { key: "ledger.general.edit", en: "Edit", zh: "编辑" },
          { key: "ledger.general.delete", en: "Delete", zh: "删除" },
          { key: "ledger.general.export", en: "Export", zh: "导出" },
        ],
      },
      {
        key: "ledger.sales", en: "Sales Ledger", zh: "销售台账",
        leaves: [
          { key: "ledger.sales.view", en: "View", zh: "查看" },
          { key: "ledger.sales.create", en: "Create", zh: "新建" },
          { key: "ledger.sales.edit", en: "Edit", zh: "编辑" },
          { key: "ledger.sales.delete", en: "Delete", zh: "删除" },
          { key: "ledger.sales.export", en: "Export", zh: "导出" },
        ],
      },
      {
        key: "ledger.shop", en: "Shop Account", zh: "店铺账目",
        leaves: [
          { key: "ledger.shop.view", en: "View", zh: "查看" },
          { key: "ledger.shop.create", en: "Create", zh: "新建" },
          { key: "ledger.shop.edit", en: "Edit", zh: "编辑" },
          { key: "ledger.shop.delete", en: "Delete", zh: "删除" },
          { key: "ledger.shop.export", en: "Export", zh: "导出" },
        ],
      },
      {
        key: "ledger.receipts", en: "Receipt Allocation", zh: "收款分配",
        leaves: [
          { key: "ledger.receipts.allocate", en: "Allocate", zh: "分配" },
        ],
      },
    ],
  },
  {
    key: "tasks", en: "Tasks", zh: "任务",
    leaves: [
      { key: "tasks.view", en: "View", zh: "查看" },
      { key: "tasks.create", en: "Create", zh: "新建" },
      { key: "tasks.editOwn", en: "Edit Own", zh: "编辑自己的" },
      { key: "tasks.editAll", en: "Edit All", zh: "编辑全部" },
      { key: "tasks.delete", en: "Delete", zh: "删除" },
      { key: "tasks.nodes.create", en: "Add Node", zh: "新增节点" },
      { key: "tasks.nodes.edit", en: "Edit Node", zh: "编辑节点" },
      { key: "tasks.nodes.delete", en: "Delete Node", zh: "删除节点" },
    ],
  },
  {
    key: "users", en: "Users", zh: "用户",
    leaves: [
      { key: "users.view", en: "View", zh: "查看" },
      { key: "users.create", en: "Create", zh: "新建" },
      { key: "users.edit", en: "Edit", zh: "编辑" },
      { key: "users.delete", en: "Delete", zh: "删除" },
      { key: "users.permissions.manage", en: "Manage Permissions", zh: "管理权限" },
    ],
  },
  {
    key: "settings", en: "Settings", zh: "设置",
    leaves: [
      { key: "settings.view", en: "View", zh: "查看" },
      { key: "settings.edit", en: "Edit", zh: "编辑" },
    ],
  },
  {
    key: "jobs", en: "Jobs (legacy)", zh: "工单（旧）",
    leaves: [{ key: "jobs", en: "Access", zh: "访问" }],
  },
]

function collectLeaves(nodes: PermNode[]): PermissionKey[] {
  const out: PermissionKey[] = []
  for (const node of nodes) {
    if (node.leaves) out.push(...node.leaves.map((l) => l.key))
    if (node.children) out.push(...collectLeaves(node.children))
  }
  return out
}

/** Every leaf permission key that exists — used as the "select all" default for new users. */
export const ALL_PERMISSIONS: PermissionKey[] = collectLeaves(PERMISSION_TREE)

// Leaf permissions an Admin can never remove from their own account — just enough
// to guarantee they can still reach the Dashboard/Users/Settings pages, not every
// sub-action under them.
export const ADMIN_SELF_PROTECTED_PERMISSIONS: PermissionKey[] = ["dashboard.view", "users.view", "settings.view"]
export function isSelfProtectedPermission(key: string): boolean {
  return (ADMIN_SELF_PROTECTED_PERMISSIONS as string[]).includes(key)
}
/** @deprecated kept only for backward-compat imports; prefer isSelfProtectedPermission */
export const ADMIN_SELF_PROTECTED = ["dashboard", "users", "settings"]

// ─── Backward-compat migration shim ────────────────────────────────────────────
// Old `User.modulePermissions` rows may still contain the coarse pre-upgrade
// keys (dashboard/customers/jobs/quotations/inventory/ledger/tasks/users/settings).
// This expands them to the new leaf-permission set at READ time (not a one-time
// destructive DB rewrite) so existing users never lose access silently.
const LEGACY_EXPANSION: Record<string, PermissionKey[]> = {
  dashboard: ["dashboard.view"],
  customers: ["customers.view", "customers.create", "customers.edit", "customers.delete", "customers.files.upload"],
  quotations: [
    "quotations.view", "quotations.create", "quotations.edit", "quotations.delete", "quotations.export",
    // Invoices were previously reached via the Quotations tab with no separate gate.
    "invoice.view", "invoice.create", "invoice.edit", "invoice.delete", "invoice.confirm", "invoice.cancel",
  ],
  inventory: [
    "stock.equipment.view", "stock.equipment.create", "stock.equipment.edit", "stock.equipment.delete", "stock.equipment.adjust",
    "stock.consumption.view", "stock.consumption.create", "stock.consumption.edit", "stock.consumption.delete", "stock.consumption.adjust",
    "stock.parts.view", "stock.parts.create", "stock.parts.edit", "stock.parts.delete", "stock.parts.adjust",
  ],
  // Old "ledger" only ever covered the general + sales books — Shop Account is new
  // and requires an explicit grant, per the mapping the user specified.
  ledger: [
    "ledger.general.view", "ledger.general.create", "ledger.general.edit", "ledger.general.delete", "ledger.general.export",
    "ledger.sales.view", "ledger.sales.create", "ledger.sales.edit", "ledger.sales.delete", "ledger.sales.export",
  ],
  tasks: [
    "tasks.view", "tasks.create", "tasks.editOwn", "tasks.editAll", "tasks.delete",
    "tasks.nodes.create", "tasks.nodes.edit", "tasks.nodes.delete",
  ],
  users: ["users.view", "users.create", "users.edit", "users.delete", "users.permissions.manage"],
  settings: ["settings.view", "settings.edit"],
  jobs: ["jobs"],
}

/** Expands any legacy coarse keys in a stored permissions array to the modern leaf set. Idempotent. */
export function migratePermissions(stored: string[]): PermissionKey[] {
  const out = new Set<PermissionKey>()
  for (const token of stored) {
    if (token.includes(".")) {
      out.add(token as PermissionKey)
      continue
    }
    const expanded = LEGACY_EXPANSION[token]
    if (expanded) expanded.forEach((k) => out.add(k))
  }
  return [...out]
}

// ─── Core checks ────────────────────────────────────────────────────────────────

/**
 * Core permission check.
 * - ADMIN role → always true
 * - empty permissions array → true (backward compat; existing users get full access)
 * - otherwise → explicit allowlist check (after expanding any legacy keys)
 */
export function hasPermission(role: Role, permissions: string[], key: PermissionKey): boolean {
  if (role === "ADMIN") return true
  if (permissions.length === 0) return true
  return migratePermissions(permissions).includes(key)
}

/** Whether the user has ANY leaf permission under a given prefix (e.g. "stock." or "ledger."). */
export function hasAnyPermission(role: Role, permissions: string[], prefix: string): boolean {
  if (role === "ADMIN") return true
  if (permissions.length === 0) return true
  return migratePermissions(permissions).some((k) => k === prefix || k.startsWith(prefix))
}

// ─── Sidebar / page-level module gating ────────────────────────────────────────
// Coarser than `hasPermission` — used for nav visibility and route guards where
// "has anything in this module" is the right question, not a specific action.

export type Module =
  | "dashboard" | "customers" | "jobs" | "quotations" | "invoice"
  | "inventory" | "ledger" | "tasks" | "users" | "settings"

const MODULE_PREFIX: Record<Module, string> = {
  dashboard: "dashboard.",
  customers: "customers.",
  jobs: "jobs",
  quotations: "quotations.",
  invoice: "invoice.",
  inventory: "stock.",
  ledger: "ledger.",
  tasks: "tasks.",
  users: "users.",
  settings: "settings.",
}

export const ALL_MODULES: Module[] = [
  "dashboard", "quotations", "invoice", "customers", "inventory", "ledger", "tasks", "users", "settings",
]

export const MODULE_LABELS: Record<Module, { en: string; zh: string }> = {
  dashboard: { en: "Dashboard", zh: "仪表盘" },
  quotations: { en: "Quotations", zh: "报价单" },
  invoice: { en: "Invoice", zh: "发票" },
  customers: { en: "Customers", zh: "客户" },
  jobs: { en: "Jobs", zh: "工单" },
  inventory: { en: "Stock", zh: "库存" },
  ledger: { en: "Ledger", zh: "台账" },
  tasks: { en: "Tasks", zh: "任务" },
  users: { en: "Users", zh: "用户" },
  settings: { en: "Settings", zh: "设置" },
}

/** Whether a role+permissions combo can view a module (any leaf under its prefix). */
export function hasModuleAccess(role: Role, module: Module, permissions: string[]): boolean {
  return hasAnyPermission(role, permissions, MODULE_PREFIX[module])
}

/** Alias kept for existing call sites; permissions now defaults to [] (= full access, back-compat). */
export function canAccess(role: Role, module: Module, permissions: string[] = []): boolean {
  return hasModuleAccess(role, module, permissions)
}

// ─── Granular resource guards used by server actions / API routes ─────────────
// Each accepts the caller's role + raw stored permissions and checks the
// specific leaf for the operation being performed.

export const canViewCustomers = (role: Role, p: string[]) => hasPermission(role, p, "customers.view")
export const canCreateCustomer = (role: Role, p: string[]) => hasPermission(role, p, "customers.create")
export const canEditCustomer = (role: Role, p: string[]) => hasPermission(role, p, "customers.edit")
export const canDeleteCustomer = (role: Role, p: string[]) => hasPermission(role, p, "customers.delete")
export const canUploadCustomerFile = (role: Role, p: string[]) => hasPermission(role, p, "customers.files.upload")

export const canViewQuotations = (role: Role, p: string[]) => hasPermission(role, p, "quotations.view")
export const canCreateQuotationPerm = (role: Role, p: string[]) => hasPermission(role, p, "quotations.create")
export const canEditQuotationPerm = (role: Role, p: string[]) => hasPermission(role, p, "quotations.edit")
export const canDeleteQuotationPerm = (role: Role, p: string[]) => hasPermission(role, p, "quotations.delete")
export const canExportQuotation = (role: Role, p: string[]) => hasPermission(role, p, "quotations.export")
export const canConvertQuotationToInvoice = (role: Role, p: string[]) => hasPermission(role, p, "quotations.convertToInvoice")

export const canViewInvoice = (role: Role, p: string[]) => hasPermission(role, p, "invoice.view")
export const canCreateInvoice = (role: Role, p: string[]) => hasPermission(role, p, "invoice.create")
export const canEditInvoice = (role: Role, p: string[]) => hasPermission(role, p, "invoice.edit")
export const canDeleteInvoice = (role: Role, p: string[]) => hasPermission(role, p, "invoice.delete")
export const canConfirmInvoice = (role: Role, p: string[]) => hasPermission(role, p, "invoice.confirm")
export const canCancelInvoice = (role: Role, p: string[]) => hasPermission(role, p, "invoice.cancel")
export const canCreateSalesRecord = (role: Role, p: string[]) => hasPermission(role, p, "invoice.createSalesRecord")

export type StockBucket = "equipment" | "consumption" | "parts"
export const canViewStock = (role: Role, p: string[], bucket: StockBucket) => hasPermission(role, p, `stock.${bucket}.view` as PermissionKey)
export const canCreateStock = (role: Role, p: string[], bucket: StockBucket) => hasPermission(role, p, `stock.${bucket}.create` as PermissionKey)
export const canEditStock = (role: Role, p: string[], bucket: StockBucket) => hasPermission(role, p, `stock.${bucket}.edit` as PermissionKey)
export const canDeleteStock = (role: Role, p: string[], bucket: StockBucket) => hasPermission(role, p, `stock.${bucket}.delete` as PermissionKey)
export const canAdjustStock = (role: Role, p: string[], bucket: StockBucket) => hasPermission(role, p, `stock.${bucket}.adjust` as PermissionKey)

export type LedgerBook = "general" | "sales" | "shop"
export const canViewLedgerBook = (role: Role, p: string[], book: LedgerBook) => hasPermission(role, p, `ledger.${book}.view` as PermissionKey)
export const canCreateLedgerEntryPerm = (role: Role, p: string[], book: LedgerBook) => hasPermission(role, p, `ledger.${book}.create` as PermissionKey)
export const canEditLedgerEntryPerm = (role: Role, p: string[], book: LedgerBook) => hasPermission(role, p, `ledger.${book}.edit` as PermissionKey)
export const canDeleteLedgerEntryPerm = (role: Role, p: string[], book: LedgerBook) => hasPermission(role, p, `ledger.${book}.delete` as PermissionKey)
export const canExportLedgerBook = (role: Role, p: string[], book: LedgerBook) => hasPermission(role, p, `ledger.${book}.export` as PermissionKey)
export const canAllocateReceipt = (role: Role, p: string[]) => hasPermission(role, p, "ledger.receipts.allocate")

export const canViewUsers = (role: Role, p: string[]) => hasPermission(role, p, "users.view")
export const canCreateUserPerm = (role: Role, p: string[]) => hasPermission(role, p, "users.create")
export const canEditUserPerm = (role: Role, p: string[]) => hasPermission(role, p, "users.edit")
export const canDeleteUserPerm = (role: Role, p: string[]) => hasPermission(role, p, "users.delete")
export const canManageUserPermissions = (role: Role, p: string[]) => hasPermission(role, p, "users.permissions.manage")

export const canViewSettingsPerm = (role: Role, p: string[]) => hasPermission(role, p, "settings.view")
export const canEditSettingsPerm = (role: Role, p: string[]) => hasPermission(role, p, "settings.edit")

// ─── Backward-compat role-only wrappers ────────────────────────────────────────
// These preserve the old call signature (role only) for code paths not yet
// threaded through with a permissions array, and now also accept an optional
// permissions array so call sites can be upgraded incrementally without a
// signature break. Opened to all roles when no permissions array is passed —
// same behavior as before this upgrade.

/** Opened to all roles. */
export function canCreateJob(_role: Role): boolean {
  return true
}

/** Engineers see only jobs assigned to them; other roles see all company jobs. */
export function isRestrictedToAssignedJobs(role: Role): boolean {
  return role === "ENGINEER"
}

export function canCreateQuotation(role: Role, permissions: string[] = []): boolean {
  return canCreateQuotationPerm(role, permissions)
}

/** Opened to all roles. */
export function canUpdateJobStatus(_role: Role): boolean {
  return true
}

/** Opened to all roles. */
export function canUploadJobMedia(_role: Role): boolean {
  return true
}

export function canManageUsers(role: Role, permissions: string[] = []): boolean {
  return hasAnyPermission(role, permissions, "users.")
}

export function canManageSettings(role: Role, permissions: string[] = []): boolean {
  return hasAnyPermission(role, permissions, "settings.")
}

/** Manage inventory (spare parts, purchase orders, stock transactions) across all 3 buckets. */
export function canManageInventory(role: Role, permissions: string[] = []): boolean {
  return hasAnyPermission(role, permissions, "stock.")
}

/** Alias for clarity at call sites that gate edit/create/delete actions. */
export const canEditInventory = canManageInventory

/** Manage the Ledger module (income/expense book, sales ledger, shop account). */
export function canManageLedger(role: Role, permissions: string[] = []): boolean {
  return hasAnyPermission(role, permissions, "ledger.")
}

// ─── Task Module ──────────────────────────────────────────────────────────────
// Task access remains primarily role/participant-driven (unchanged business logic
// below); the new tasks.* permission keys are enforced as an additional prerequisite
// gate ahead of the existing rules, not a replacement for the participant model.

/** Admin and Manager can create tasks. */
export function canCreateTask(role: Role): boolean {
  return role === "ADMIN" || role === "MANAGER"
}

/** Returns true if userId is the creator or an explicit participant of the task. */
export function isTaskParticipant(
  userId: string,
  task: { createdById: string; participants: Array<{ userId: string }> }
): boolean {
  return task.createdById === userId || task.participants.some((p) => p.userId === userId)
}

/** Admin sees all tasks; others must be creator or participant. */
export function canViewTask(
  role: Role,
  userId: string,
  task: { createdById: string; participants: Array<{ userId: string }> }
): boolean {
  if (role === "ADMIN") return true
  return isTaskParticipant(userId, task)
}

/** Participant (creator or listed participant) can add steps while task is ACTIVE. */
export function canAddTaskStep(
  userId: string,
  task: { status: string; createdById: string; participants: Array<{ userId: string }> }
): boolean {
  if (task.status !== "ACTIVE") return false
  return isTaskParticipant(userId, task)
}

/** Participant can complete an ACTIVE task. */
export function canCompleteTask(
  userId: string,
  task: { status: string; createdById: string; participants: Array<{ userId: string }> }
): boolean {
  if (task.status !== "ACTIVE") return false
  return isTaskParticipant(userId, task)
}

/** Only Admin can reopen a completed task. */
export function canReopenTask(role: Role): boolean {
  return role === "ADMIN"
}

/** Only task participants may upload images to a step, and only while the task is ACTIVE. */
export const canUploadTaskStepImage = canAddTaskStep

/** Admin can remove any task step image; otherwise the same rule as uploading (participant, ACTIVE task). */
export function canDeleteTaskStepImage(
  role: Role,
  userId: string,
  task: { status: string; createdById: string; participants: Array<{ userId: string }> }
): boolean {
  if (role === "ADMIN") return true
  return canAddTaskStep(userId, task)
}

/**
 * Edit/delete a single progress node (TaskStep). Admin and Manager can
 * always manage a node, even on a completed task — mirrors the existing
 * ADMIN/MANAGER "task management" role used by canCreateTask/deleteTask.
 * Everyone else may only act while the task is still ACTIVE, and only on a
 * node they authored or a task they created (narrower than general task
 * participation, since editing/deleting is more sensitive than adding a
 * new step).
 */
export function canManageTaskStep(
  role: Role,
  userId: string,
  step: { createdById: string },
  task: { status: string; createdById: string }
): boolean {
  if (role === "ADMIN" || role === "MANAGER") return true
  if (task.status !== "ACTIVE") return false
  return step.createdById === userId || task.createdById === userId
}

/**
 * Add/remove participants mid-task. Mirrors canManageTaskStep's tier exactly
 * (same "task edit" authority, just without a step to also check authorship
 * of): Admin/Manager always; otherwise only the task's own creator, and only
 * while it's still ACTIVE. A plain participant who isn't the creator can see
 * the participant list but not change it.
 */
export function canManageTaskParticipants(
  role: Role,
  userId: string,
  task: { status: string; createdById: string }
): boolean {
  if (role === "ADMIN" || role === "MANAGER") return true
  if (task.status !== "ACTIVE") return false
  return task.createdById === userId
}

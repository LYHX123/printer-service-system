/**
 * Selective System Initialization — domain graph.
 *
 * Built by reading prisma/schema.prisma end-to-end (every model, every FK,
 * nullability, and the ones with onDelete: Cascade already declared) rather
 * than assumed from names. Two things came out of that reading that aren't
 * obvious from the module list alone:
 *
 * 1. The legacy "Jobs" feature (Equipment/ServiceJob/JobPhoto/RepairReport/
 *    JobPart/JobStatusLog/EquipmentPhoto/MeterReading/CustomerContract/
 *    CommunicationLog) isn't one of the 7 requested modules, has no
 *    permission/nav entry of its own (permissions.ts calls it "legacy,
 *    unrestructured" and it's "not linked from the sidebar today"), and
 *    every one of those tables has a NOT NULL foreign key straight into
 *    Customer or Equipment. There is no way to delete Customer while any of
 *    them still exist, and there's no separate checkbox to ask the user to
 *    also clear them. They're bundled into the CUSTOMER domain's delete set
 *    (see DOMAIN_TABLES) — never exposed as their own module, always
 *    deleted together with Customer, never deleted on their own.
 * 2. LedgerCategory / ShopAccountCategory are chart-of-accounts style
 *    configuration (unique per companyId+type+name), not transactional
 *    business records — LedgerEntry/ShopAccountEntry reference them with a
 *    required (non-null) categoryId, but deleting the child rows while
 *    keeping the parent category rows is always FK-safe. They're preserved
 *    (not deleted) by Ledger/Shop Account initialization, matching the
 *    equivalent "willPreserveLedgerCategories" behavior in the Insurance
 *    Management System's Production Initialization feature this was asked
 *    to mirror.
 */

export const INITIALIZATION_MODULES = [
  "CUSTOMER",
  "STOCK",
  "QUOTATION",
  "INVOICE",
  "LEDGER",
  "SHOP_ACCOUNT",
  "TASKS",
] as const

export type InitializationModule = (typeof INITIALIZATION_MODULES)[number]

export interface ModuleInfo {
  labelEn: string
  labelZh: string
  descriptionEn: string
  descriptionZh: string
}

export const MODULE_INFO: Record<InitializationModule, ModuleInfo> = {
  CUSTOMER: {
    labelEn: "Customer",
    labelZh: "客户",
    descriptionEn: "Delete all customer records and customer document database records.",
    descriptionZh: "删除所有客户记录及客户文件数据库记录。",
  },
  STOCK: {
    labelEn: "Stock",
    labelZh: "库存",
    descriptionEn: "Delete all equipment, consumption, parts and stock movement records.",
    descriptionZh: "删除所有设备、耗材、零件及库存变动记录。",
  },
  QUOTATION: {
    labelEn: "Quotation",
    labelZh: "报价单",
    descriptionEn: "Delete all quotations, items, versions, snapshots and quotation document records.",
    descriptionZh: "删除所有报价单、明细、版本、快照及报价单文件记录。",
  },
  INVOICE: {
    labelEn: "Invoice",
    labelZh: "发票",
    descriptionEn: "Delete all invoices, invoice items, invoice documents and ETR database records.",
    descriptionZh: "删除所有发票、发票明细、发票文件及 ETR 数据库记录。",
  },
  LEDGER: {
    labelEn: "Ledger",
    labelZh: "台账",
    descriptionEn: "Delete sales ledger, income, expense, payment and related financial records. Ledger categories are kept.",
    descriptionZh: "删除销售台账、收入、支出、收款及相关财务记录。台账分类将保留。",
  },
  SHOP_ACCOUNT: {
    labelEn: "Shop Account",
    labelZh: "店铺账目",
    descriptionEn: "Delete all Shop Account income/expense records. Shop Account categories are kept.",
    descriptionZh: "删除所有店铺账目收入/支出记录。店铺账目分类将保留。",
  },
  TASKS: {
    labelEn: "Tasks",
    labelZh: "任务",
    descriptionEn: "Delete all tasks, participants, progress and task-related activity records.",
    descriptionZh: "删除所有任务、参与人、进度及任务相关活动记录。",
  },
}

/**
 * Every table an InitializationModule deletes, in the exact order given —
 * this list order IS the global child-before-parent delete order (see
 * GLOBAL_DELETE_ORDER below, which just concatenates these). Verified
 * against every FK in schema.prisma; each table here appears strictly
 * before anything it holds a foreign key into.
 */
export const DOMAIN_TABLES: Record<InitializationModule, string[]> = {
  TASKS: ["TaskStepImage", "TaskStep", "TaskParticipant", "Task"],
  LEDGER: ["ReceiptAllocation", "SalesLedgerEntry", "LedgerEntry"],
  SHOP_ACCOUNT: ["ShopAccountEntry"],
  INVOICE: ["InvoiceDocument", "InvoiceItem", "Invoice"],
  QUOTATION: ["QuotationDocument", "QuotationVersion", "QuotationItem", "Quotation"],
  // Bundled legacy Jobs-module tables — see file header note (1). Never
  // exposed as their own checkbox; always deleted together with Customer,
  // in child-before-parent order, because every one of them holds a NOT
  // NULL FK into Customer or Equipment.
  CUSTOMER: [
    "JobStatusLog",
    "JobPhoto",
    "JobPart",
    "RepairReport",
    "MeterReading",
    "EquipmentPhoto",
    "ServiceJob",
    "Equipment",
    "CommunicationLog",
    "CustomerContract",
    "CustomerDocument",
    "CustomerBranch",
    "Customer",
  ],
  STOCK: ["InventoryTransaction", "InventoryStock", "PurchaseOrderItem", "PurchaseOrder", "SparePart"],
}

/**
 * Single global delete order valid for ANY subset of selected modules —
 * each module's own tables are already internally ordered (see
 * DOMAIN_TABLES), and the modules themselves are ordered here so that
 * cross-domain FKs are always satisfied: Tasks/Ledger/ShopAccount have no
 * incoming cross-domain FKs so they can go first; Invoice must go before
 * Quotation (Invoice.quotationId); Quotation/Invoice/Customer's own legacy
 * Jobs bundle must go before Customer (their customerId is NOT NULL); Stock
 * goes last since nothing outside Stock holds a NOT NULL FK into it (the
 * nullable ones — QuotationItem/InvoiceItem/JobPart.partId — are cleared by
 * a SET NULL pre-step before Stock deletion, see delete.ts).
 */
export const GLOBAL_DELETE_ORDER: InitializationModule[] = [
  "TASKS",
  "LEDGER",
  "SHOP_ACCOUNT",
  "INVOICE",
  "QUOTATION",
  "CUSTOMER",
  "STOCK",
]

export interface RequiredModuleReason {
  module: InitializationModule
  /** Which already-selected module triggered this requirement. */
  requiredBy: InitializationModule
  /** How many rows were found that would otherwise be left dangling. */
  affectedRecordCount: number
  reasonEn: string
  reasonZh: string
}

export interface InitializationPlan {
  companyId: string
  /** Exactly what the user checked. */
  selectedModules: InitializationModule[]
  /** Modules the dependency resolver added — never silently deleted, always shown before execution. */
  requiredModules: InitializationModule[]
  requiredReasons: RequiredModuleReason[]
  /** selectedModules ∪ requiredModules, in GLOBAL_DELETE_ORDER. */
  effectiveModules: InitializationModule[]
  /** Per-table row counts that will be deleted, company-scoped. */
  recordCounts: Record<string, number>
  resetNumbering: boolean
  numberingNote: string
}

import type {
  Company,
  User,
  Customer,
  CustomerBranch,
  CustomerContract,
  Equipment,
  MeterReading,
  ServiceJob,
  Quotation,
  QuotationItem,
  JobPhoto,
  RepairReport,
  JobPart,
  JobStatusLog,
  SparePart,
  InventoryStock,
  InventoryTransaction,
  TransactionType,
  Role,
  JobStatus,
  Priority,
  ServiceType,
  EquipmentType,
  PhotoType,
  QuotationStatus,
  PartCategory,
  ContractType,
  ContractStatus,
  CommunicationLog,
  CommunicationChannel,
  CommunicationMessageType,
  LedgerCategory,
  LedgerEntry,
  SalesLedgerEntry,
  LedgerEntryType,
  LedgerPaymentMethod,
  SalesPaymentStatus,
} from "@/generated/prisma/client"

export type {
  Company,
  User,
  Customer,
  CustomerBranch,
  CustomerContract,
  Equipment,
  MeterReading,
  ServiceJob,
  Quotation,
  QuotationItem,
  JobPhoto,
  RepairReport,
  JobPart,
  JobStatusLog,
  SparePart,
  InventoryStock,
  InventoryTransaction,
  TransactionType,
  Role,
  JobStatus,
  Priority,
  ServiceType,
  EquipmentType,
  PhotoType,
  QuotationStatus,
  PartCategory,
  ContractType,
  ContractStatus,
  CommunicationLog,
  CommunicationChannel,
  CommunicationMessageType,
  LedgerCategory,
  LedgerEntry,
  SalesLedgerEntry,
  LedgerEntryType,
  LedgerPaymentMethod,
  SalesPaymentStatus,
}

// ─── Session ──────────────────────────────────────────────────────────────────

export type SessionUser = {
  id: string
  name: string
  email: string
  role: Role
  companyId: string
}

// ─── Composite types ──────────────────────────────────────────────────────────

export type JobWithRelations = ServiceJob & {
  customer: Customer
  branch: CustomerBranch | null
  equipment: Equipment
  assignedTo: Pick<User, "id" | "name" | "email">
  createdBy: Pick<User, "id" | "name">
  report: RepairReport | null
  photos: JobPhoto[]
  statusLogs: (JobStatusLog & { changedBy: Pick<User, "id" | "name"> })[]
  quotation: Quotation | null
}

export type QuotationWithRelations = Quotation & {
  customer: Customer
  branch: CustomerBranch | null
  equipment: Equipment | null
  createdBy: Pick<User, "id" | "name">
  items: QuotationItem[]
  convertedJob: Pick<ServiceJob, "id" | "jobNumber"> | null
}

export type CustomerContractWithRelations = CustomerContract & {
  customer: Customer
  branch: CustomerBranch | null
  createdBy: Pick<User, "id" | "name">
}

export type MeterReadingWithJob = MeterReading & {
  job: Pick<ServiceJob, "id" | "jobNumber"> | null
  recordedBy: Pick<User, "id" | "name">
}

export type SparePartWithStock = SparePart & {
  stock: InventoryStock | null
}

export type InventoryTransactionWithRelations = InventoryTransaction & {
  part: Pick<SparePart, "id" | "partNumber" | "name" | "unit" | "category">
  performedBy: Pick<User, "id" | "name">
  job: Pick<ServiceJob, "id" | "jobNumber"> | null
}

export type LedgerEntryWithRelations = Omit<LedgerEntry, "amount"> & {
  amount: number
  category: Pick<LedgerCategory, "id" | "name" | "type">
  createdBy: Pick<User, "id" | "name">
}

// ─── Status transitions ───────────────────────────────────────────────────────

export const JOB_STATUS_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  RECEIVED: ["DIAGNOSING"],
  DIAGNOSING: ["WAITING_SPARE_PARTS", "WAITING_CUSTOMER_APPROVAL", "REPAIRING"],
  WAITING_CUSTOMER_APPROVAL: ["WAITING_SPARE_PARTS", "REPAIRING", "CANCELLED"],
  WAITING_SPARE_PARTS: ["REPAIRING"],
  REPAIRING: ["TESTING"],
  TESTING: ["READY_FOR_COLLECTION", "REPAIRING"],
  READY_FOR_COLLECTION: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
}

// ─── Label maps ───────────────────────────────────────────────────────────────

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  RECEIVED: "Received",
  DIAGNOSING: "Diagnosing",
  WAITING_SPARE_PARTS: "Waiting Spare Parts",
  WAITING_CUSTOMER_APPROVAL: "Waiting Customer Approval",
  REPAIRING: "Repairing",
  TESTING: "Testing",
  READY_FOR_COLLECTION: "Ready for Collection",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  ENGINEER: "Engineer",
  RECEPTIONIST: "Receptionist",
}

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  REPAIR: "Repair",
  MAINTENANCE: "Maintenance",
  UPGRADE: "Upgrade",
  REFURBISHMENT: "Refurbishment",
  INSTALLATION: "Installation",
  INSPECTION: "Inspection",
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
}

export const EQUIPMENT_TYPE_LABELS: Record<EquipmentType, string> = {
  PRINTER: "Printer",
  COPIER: "Copier",
  LAPTOP: "Laptop",
  DESKTOP_COMPUTER: "Desktop Computer",
  PROJECTOR: "Projector",
  CCTV_SYSTEM: "CCTV System",
  OTHER: "Other",
}

export const QUOTATION_STATUS_LABELS: Record<QuotationStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CONVERTED: "Converted to Job",
  EXPIRED: "Expired",
}

export const QUOTATION_STATUS_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  DRAFT: ["SENT"],
  SENT: ["APPROVED", "REJECTED"],
  APPROVED: [],
  REJECTED: [],
  CONVERTED: [],
  EXPIRED: [],
}

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  SERVICE_CONTRACT: "Service Contract",
  MAINTENANCE_AGREEMENT: "Maintenance Agreement",
  WARRANTY_DOCUMENT: "Warranty Document",
  OTHER: "Other",
}

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  ACTIVE: "Active",
  EXPIRED: "Expired",
  TERMINATED: "Terminated",
}

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  IN: "Stock In",
  OUT: "Stock Out",
  RETURN: "Return",
  DAMAGE: "Damage",
  ADJUSTMENT: "Adjustment",
}

export const COMMUNICATION_CHANNEL_LABELS: Record<CommunicationChannel, string> = {
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
}

export const COMMUNICATION_MESSAGE_TYPE_LABELS: Record<CommunicationMessageType, string> = {
  JOB_RECEIVED: "Job Received",
  JOB_IN_PROGRESS: "Job In Progress",
  AWAITING_CUSTOMER_APPROVAL: "Awaiting Customer Approval",
  QUOTATION_SENT: "Quotation Sent",
  QUOTATION_APPROVED: "Quotation Approved",
  JOB_COMPLETED: "Job Completed",
  READY_FOR_COLLECTION: "Ready for Collection",
  PAYMENT_REMINDER: "Payment Reminder",
  GENERAL: "General",
}

export const LEDGER_ENTRY_TYPE_LABELS: Record<LedgerEntryType, string> = {
  INCOME: "Income",
  EXPENSE: "Expense",
}

export const LEDGER_PAYMENT_METHOD_LABELS: Record<LedgerPaymentMethod, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank Transfer",
  CHEQUE: "Cheque",
  CARD: "Card",
  OTHER: "Other",
}

export const SALES_PAYMENT_STATUS_LABELS: Record<SalesPaymentStatus, string> = {
  UNPAID: "Unpaid",
  PARTIAL: "Partial",
  PAID: "Paid",
}

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Rent",
  "Salary",
  "Transport",
  "Office Supplies",
  "Utilities",
  "Repair Cost",
  "Other",
]

export const DEFAULT_INCOME_CATEGORIES = [
  "Sales Income",
  "Service Income",
  "Other Income",
]

export const PART_CATEGORY_LABELS: Record<PartCategory, string> = {
  TONER: "Toner",
  DRUM: "Drum Unit",
  DEVELOPER: "Developer",
  FUSER: "Fuser Assembly",
  MAINTENANCE_KIT: "Maintenance Kit",
  ROLLER: "Roller",
  LAPTOP_PART: "Laptop Part",
  DESKTOP_PART: "Desktop / PC Part",
  CCTV_PART: "CCTV Part",
  PROJECTOR_PART: "Projector Part",
  GENERAL: "General",
}

// ─── Equipment-adaptive UI helpers ────────────────────────────────────────────

/** Equipment types where meter readings (page counters) are collected */
export const METER_READING_TYPES: EquipmentType[] = ["PRINTER", "COPIER"]

/** Equipment types where UPGRADE service type is applicable */
export const UPGRADE_APPLICABLE_TYPES: EquipmentType[] = [
  "LAPTOP",
  "DESKTOP_COMPUTER",
]

/** Default part categories relevant to each equipment type (for inventory filtering) */
export const EQUIPMENT_PART_CATEGORIES: Record<EquipmentType, PartCategory[]> = {
  PRINTER: ["TONER", "DRUM", "DEVELOPER", "FUSER", "MAINTENANCE_KIT", "ROLLER"],
  COPIER: ["TONER", "DRUM", "DEVELOPER", "FUSER", "MAINTENANCE_KIT", "ROLLER"],
  LAPTOP: ["LAPTOP_PART"],
  DESKTOP_COMPUTER: ["DESKTOP_PART"],
  PROJECTOR: ["PROJECTOR_PART"],
  CCTV_SYSTEM: ["CCTV_PART"],
  OTHER: ["GENERAL"],
}

/** Technician notes placeholder by equipment type (AI input field) */
export const TECHNICIAN_NOTES_PLACEHOLDER: Record<EquipmentType, string> = {
  PRINTER:
    "e.g. Found paper jam at fuser unit. Replaced fuser assembly and pickup roller. Cleaned paper path. Tested 50 pages — OK.",
  COPIER:
    "e.g. Drum unit worn out, causing light print. Replaced drum and developer. Cleaned corona wire. Print quality restored.",
  LAPTOP:
    "e.g. Overheating due to blocked fan. Cleaned heat sink, replaced thermal paste. RAM upgraded from 8GB to 16GB. Tested under load — stable.",
  DESKTOP_COMPUTER:
    "e.g. PSU failed. Replaced 550W PSU. Cleaned dust from case and CPU cooler. Replaced thermal paste. System stable at full load.",
  PROJECTOR:
    "e.g. Lamp hours exceeded 3000h causing dim output. Replaced lamp unit. Cleaned air filter. Brightness restored to factory spec.",
  CCTV_SYSTEM:
    "e.g. Camera 3 and 4 offline due to faulty switch. Replaced POE switch. Reconfigured NVR. All 8 cameras recording.",
  OTHER:
    "Enter technician observations, actions taken, and parts replaced during service",
}

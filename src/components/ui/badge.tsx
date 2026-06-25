"use client"

import { type ReactNode } from "react"
import {
  Printer,
  Copy,
  Laptop,
  Monitor,
  Projector,
  Camera,
  HelpCircle,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import type {
  JobStatus,
  Priority,
  EquipmentType,
  QuotationStatus,
  ContractStatus,
  Role,
  PartCategory,
  LedgerEntryType,
  LedgerPaymentMethod,
  SalesPaymentStatus,
} from "@/types"
import type { TranslationKey } from "@/lib/i18n/translations"
import {
  JOB_STATUS_LABELS,
  PRIORITY_LABELS,
  EQUIPMENT_TYPE_LABELS,
  QUOTATION_STATUS_LABELS,
  CONTRACT_STATUS_LABELS,
  ROLE_LABELS,
  PART_CATEGORY_LABELS,
} from "@/types"

// ─── Base Badge ───────────────────────────────────────────────────────────────

interface BadgeProps {
  children: ReactNode
  className?: string
}

export function Badge({ children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        className
      )}
    >
      {children}
    </span>
  )
}

// ─── Status Badge (JobStatus) ─────────────────────────────────────────────────

const JOB_STATUS_STYLES: Record<JobStatus, string> = {
  RECEIVED: "bg-blue-100 text-blue-700",
  DIAGNOSING: "bg-yellow-100 text-yellow-700",
  WAITING_SPARE_PARTS: "bg-orange-100 text-orange-700",
  WAITING_CUSTOMER_APPROVAL: "bg-purple-100 text-purple-700",
  REPAIRING: "bg-indigo-100 text-indigo-700",
  TESTING: "bg-cyan-100 text-cyan-700",
  READY_FOR_COLLECTION: "bg-green-100 text-green-700",
  DELIVERED: "bg-slate-100 text-slate-600",
  CANCELLED: "bg-red-100 text-red-700",
}

export function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <Badge className={JOB_STATUS_STYLES[status]}>
      {JOB_STATUS_LABELS[status]}
    </Badge>
  )
}

// ─── Priority Badge ───────────────────────────────────────────────────────────

const PRIORITY_STYLES: Record<Priority, string> = {
  LOW: "bg-slate-100 text-slate-600",
  NORMAL: "bg-blue-100 text-blue-700",
  HIGH: "bg-orange-100 text-orange-700",
  URGENT: "bg-red-100 text-red-700",
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge className={PRIORITY_STYLES[priority]}>
      {PRIORITY_LABELS[priority]}
    </Badge>
  )
}

// ─── Equipment Type Badge ─────────────────────────────────────────────────────

const EQUIPMENT_ICONS: Record<EquipmentType, LucideIcon> = {
  PRINTER: Printer,
  COPIER: Copy,
  LAPTOP: Laptop,
  DESKTOP_COMPUTER: Monitor,
  PROJECTOR: Projector,
  CCTV_SYSTEM: Camera,
  OTHER: HelpCircle,
}

const EQUIPMENT_STYLES: Record<EquipmentType, string> = {
  PRINTER: "bg-blue-100 text-blue-700",
  COPIER: "bg-indigo-100 text-indigo-700",
  LAPTOP: "bg-green-100 text-green-700",
  DESKTOP_COMPUTER: "bg-teal-100 text-teal-700",
  PROJECTOR: "bg-orange-100 text-orange-700",
  CCTV_SYSTEM: "bg-purple-100 text-purple-700",
  OTHER: "bg-slate-100 text-slate-600",
}

export function EquipmentTypeBadge({ type }: { type: EquipmentType }) {
  const Icon = EQUIPMENT_ICONS[type]
  return (
    <Badge className={EQUIPMENT_STYLES[type]}>
      <Icon className="h-3 w-3 shrink-0" />
      {EQUIPMENT_TYPE_LABELS[type]}
    </Badge>
  )
}

/** Returns just the lucide icon component for an equipment type */
export function EquipmentTypeIcon({
  type,
  className,
}: {
  type: EquipmentType
  className?: string
}) {
  const Icon = EQUIPMENT_ICONS[type]
  return <Icon className={cn("h-4 w-4", className)} />
}

// ─── Quotation Status Badge ───────────────────────────────────────────────────

const QUOTATION_STYLES: Record<QuotationStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  SENT: "bg-blue-100 text-blue-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  CONVERTED: "bg-violet-100 text-violet-700",
  EXPIRED: "bg-amber-100 text-amber-700",
}

export function QuotationStatusBadge({ status }: { status: QuotationStatus }) {
  const { t } = useLanguage()
  const label =
    status === "APPROVED" ? t("approved") :
    status === "REJECTED" ? t("rejected") :
    QUOTATION_STATUS_LABELS[status]
  return (
    <Badge className={QUOTATION_STYLES[status]}>
      {label}
    </Badge>
  )
}

// ─── Contract Status Badge ────────────────────────────────────────────────────

const CONTRACT_STATUS_STYLES: Record<ContractStatus, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  EXPIRED: "bg-amber-100 text-amber-700",
  TERMINATED: "bg-red-100 text-red-700",
}

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  return (
    <Badge className={CONTRACT_STATUS_STYLES[status]}>
      {CONTRACT_STATUS_LABELS[status]}
    </Badge>
  )
}

// ─── Part Category Badge ──────────────────────────────────────────────────────

export function PartCategoryBadge({ category }: { category: PartCategory }) {
  return (
    <Badge className="bg-slate-100 text-slate-600">
      {PART_CATEGORY_LABELS[category]}
    </Badge>
  )
}

// ─── Stock Level Badge ────────────────────────────────────────────────────────

const STOCK_LEVEL_STYLES: Record<"in_stock" | "low" | "out", string> = {
  in_stock: "bg-green-100 text-green-700",
  low: "bg-orange-100 text-orange-700",
  out: "bg-red-100 text-red-700",
}

const STOCK_LEVEL_LABELS: Record<"in_stock" | "low" | "out", string> = {
  in_stock: "In Stock",
  low: "Low Stock",
  out: "Out of Stock",
}

export function StockLevelBadge({ level }: { level: "in_stock" | "low" | "out" }) {
  return <Badge className={STOCK_LEVEL_STYLES[level]}>{STOCK_LEVEL_LABELS[level]}</Badge>
}

// ─── Transaction Type Badge ────────────────────────────────────────────────────

const TRANSACTION_TYPE_STYLES: Record<"IN" | "OUT" | "RETURN" | "DAMAGE" | "ADJUSTMENT", string> = {
  IN: "bg-green-100 text-green-700",
  OUT: "bg-red-100 text-red-700",
  RETURN: "bg-teal-100 text-teal-700",
  DAMAGE: "bg-orange-100 text-orange-700",
  ADJUSTMENT: "bg-blue-100 text-blue-700",
}

const TRANSACTION_TYPE_LABELS_LOCAL: Record<"IN" | "OUT" | "RETURN" | "DAMAGE" | "ADJUSTMENT", string> = {
  IN: "Stock In",
  OUT: "Stock Out",
  RETURN: "Return",
  DAMAGE: "Damage",
  ADJUSTMENT: "Adjustment",
}

export function TransactionTypeBadge({ type }: { type: "IN" | "OUT" | "RETURN" | "DAMAGE" | "ADJUSTMENT" }) {
  return <Badge className={TRANSACTION_TYPE_STYLES[type]}>{TRANSACTION_TYPE_LABELS_LOCAL[type]}</Badge>
}

// ─── Warranty Badge ───────────────────────────────────────────────────────────

export function WarrantyBadge({ warrantyExpires }: { warrantyExpires: Date | string | null }) {
  if (!warrantyExpires) {
    return <Badge className="bg-slate-100 text-slate-500">No Warranty</Badge>
  }
  const isActive = new Date(warrantyExpires).getTime() > Date.now()
  return isActive ? (
    <Badge className="bg-green-100 text-green-700">Warranty Active</Badge>
  ) : (
    <Badge className="bg-red-100 text-red-700">Warranty Expired</Badge>
  )
}

// ─── Role Badge ───────────────────────────────────────────────────────────────

const ROLE_STYLES: Record<Role, string> = {
  ADMIN: "bg-red-100 text-red-700",
  MANAGER: "bg-orange-100 text-orange-700",
  ENGINEER: "bg-blue-100 text-blue-700",
  RECEPTIONIST: "bg-green-100 text-green-700",
}

export function RoleBadge({ role }: { role: Role }) {
  return (
    <Badge className={ROLE_STYLES[role]}>{ROLE_LABELS[role]}</Badge>
  )
}

// ─── Ledger Entry Type Badge ──────────────────────────────────────────────────

const LEDGER_ENTRY_TYPE_STYLES: Record<LedgerEntryType, string> = {
  INCOME: "bg-green-100 text-green-700",
  EXPENSE: "bg-red-100 text-red-700",
}

export function LedgerEntryTypeBadge({ type }: { type: LedgerEntryType }) {
  const { t } = useLanguage()
  return (
    <Badge className={LEDGER_ENTRY_TYPE_STYLES[type]}>
      {type === "INCOME" ? t("income") : t("expense")}
    </Badge>
  )
}

// ─── Sales Payment Status Badge ───────────────────────────────────────────────

const SALES_PAYMENT_STATUS_STYLES: Record<SalesPaymentStatus, string> = {
  PAID: "bg-green-100 text-green-700",
  PARTIAL: "bg-orange-100 text-orange-700",
  UNPAID: "bg-red-100 text-red-700",
}

export function SalesPaymentStatusBadge({ status }: { status: SalesPaymentStatus }) {
  const { t } = useLanguage()
  const label = status === "PAID" ? t("paid") : status === "PARTIAL" ? t("partial") : t("unpaid")
  return (
    <Badge className={SALES_PAYMENT_STATUS_STYLES[status]}>{label}</Badge>
  )
}

// ─── Payment Method Label ─────────────────────────────────────────────────────

const PAYMENT_METHOD_TRANSLATION_KEYS: Record<LedgerPaymentMethod, TranslationKey> = {
  CASH: "paymentMethodCash",
  BANK_TRANSFER: "paymentMethodBankTransfer",
  CHEQUE: "paymentMethodCheque",
  CARD: "paymentMethodCard",
  OTHER: "paymentMethodOther",
}

export function PaymentMethodLabel({ method }: { method: LedgerPaymentMethod }) {
  const { t } = useLanguage()
  return <>{t(PAYMENT_METHOD_TRANSLATION_KEYS[method])}</>
}

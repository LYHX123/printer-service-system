import { z } from "zod"
import { DEFAULT_VAT_PERCENT } from "@/lib/constants"

// ─── Customer ─────────────────────────────────────────────────────────────────

export const CustomerSchema = z.object({
  companyName: z.string().min(1, "Company name is required").max(100),
  pinNumber: z.string().max(30).optional().or(z.literal("")),
  name: z.string().max(100).optional().or(z.literal("")),
  phone: z.string().min(1, "Phone number is required").max(30),
  location: z.string().max(500).optional().or(z.literal("")),
})

export type CustomerInput = z.infer<typeof CustomerSchema>

// ─── Job ──────────────────────────────────────────────────────────────────────

export const JobSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  branchId: z.string().optional().or(z.literal("")),
  equipmentId: z.string().min(1, "Equipment is required"),
  serviceType: z.enum([
    "REPAIR",
    "MAINTENANCE",
    "UPGRADE",
    "REFURBISHMENT",
    "INSTALLATION",
    "INSPECTION",
  ]),
  assignedToId: z.string().min(1, "Assigned engineer is required"),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  problemDesc: z.string().min(1, "Problem description is required").max(2000),
  dueDate: z.string().optional().or(z.literal("")),
  internalNotes: z.string().max(2000).optional().or(z.literal("")),
  // Meter readings at intake — only for PRINTER/COPIER
  meterBlack: z.coerce.number().int().min(0).optional(),
  meterColor: z.coerce.number().int().min(0).optional(),
})

export type JobInput = z.infer<typeof JobSchema>

// ─── Status Update ────────────────────────────────────────────────────────────

export const StatusUpdateSchema = z
  .object({
    toStatus: z.enum([
      "RECEIVED",
      "DIAGNOSING",
      "WAITING_SPARE_PARTS",
      "WAITING_CUSTOMER_APPROVAL",
      "REPAIRING",
      "TESTING",
      "READY_FOR_COLLECTION",
      "DELIVERED",
      "CANCELLED",
    ]),
    note: z.string().max(500).optional().or(z.literal("")),
    warrantyPeriod: z.coerce.number().int().min(1).max(3650).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.toStatus === "CANCELLED" && !data.note) {
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: "A reason is required when cancelling a job",
      })
    }
    if (data.toStatus === "DELIVERED" && !data.warrantyPeriod) {
      ctx.addIssue({
        code: "custom",
        path: ["warrantyPeriod"],
        message: "Warranty period (days) is required",
      })
    }
  })

export type StatusUpdateInput = z.infer<typeof StatusUpdateSchema>

// ─── Assign Engineer ──────────────────────────────────────────────────────────

export const AssignEngineerSchema = z.object({
  assignedToId: z.string().min(1, "Engineer is required"),
})

export type AssignEngineerInput = z.infer<typeof AssignEngineerSchema>

// ─── Technician Notes ─────────────────────────────────────────────────────────

export const TechnicianNotesSchema = z.object({
  technicianNotes: z.string().max(5000).optional().or(z.literal("")),
})

export type TechnicianNotesInput = z.infer<typeof TechnicianNotesSchema>

// ─── Quotation ────────────────────────────────────────────────────────────────

export const QuotationItemInputSchema = z.object({
  partId: z.string().min(1, "Stock item is required"),
  quantity: z.coerce.number().int().min(1, "Min 1"),
  unitPrice: z.coerce.number().min(0, "Must be ≥ 0"),
})

export type QuotationItemInput = z.infer<typeof QuotationItemInputSchema>

export const QuotationSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  validUntil: z.string().optional().or(z.literal("")),
  vatPercent: z.coerce.number().min(0).max(100).default(DEFAULT_VAT_PERCENT),
  remarks: z.string().max(2000).optional().or(z.literal("")),
  internalNotes: z.string().max(2000).optional().or(z.literal("")),
  items: z.array(QuotationItemInputSchema).min(1, "Add at least one stock item"),
})

// ─── Company Settings ──────────────────────────────────────────────────────────

export const CompanySettingsSchema = z.object({
  name: z.string().min(1, "Company name is required").max(150),
  address: z.string().max(500).optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  website: z.string().max(150).optional().or(z.literal("")),
  kraPin: z.string().max(30).optional().or(z.literal("")),
  vatPercent: z.coerce.number().min(0).max(100).default(DEFAULT_VAT_PERCENT),
  currency: z.string().min(1, "Currency is required").max(10),
  timezone: z.string().min(1, "Timezone is required").max(50),
})

export type CompanySettingsInput = z.infer<typeof CompanySettingsSchema>

export type QuotationInput = z.infer<typeof QuotationSchema>

export const QuotationStatusSchema = z.object({
  toStatus: z.enum(["DRAFT", "SENT", "APPROVED", "REJECTED", "EXPIRED"]),
  note: z.string().max(500).optional().or(z.literal("")),
})

export type QuotationStatusInput = z.infer<typeof QuotationStatusSchema>

// ─── Repair Report ────────────────────────────────────────────────────────────

export const JobPartInputSchema = z.object({
  partId: z.string().optional().or(z.literal("")),
  partName: z.string().min(1, "Part name required").max(200),
  quantity: z.coerce.number().int().min(1, "Min 1"),
  unitPrice: z.coerce.number().min(0, "Must be ≥ 0"),
})

export type JobPartInput = z.infer<typeof JobPartInputSchema>

export const RepairReportSchema = z.object({
  diagnosis: z.string().min(1, "Diagnosis is required").max(3000),
  workDone: z.string().min(1, "Work performed is required").max(3000),
  recommendations: z.string().max(2000).optional().or(z.literal("")),
  labourCost: z.coerce.number().min(0).default(0),
  parts: z.array(JobPartInputSchema).default([]),
})

export type RepairReportInput = z.infer<typeof RepairReportSchema>

// ─── User Management ───────────────────────────────────────────────────────────

const RoleEnum = z.enum(["ADMIN", "MANAGER", "ENGINEER", "RECEPTIONIST"])

const optionalText = (max: number) =>
  z.string().max(max).optional().or(z.literal(""))

export const CreateUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address").max(150),
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
  role: RoleEnum,
  modulePermissions: z.array(z.string()).default([]),
  phone: optionalText(30),
  department: optionalText(100),
  position: optionalText(100),
})

export type CreateUserInput = z.infer<typeof CreateUserSchema>

export const UpdateUserRoleSchema = z.object({
  role: RoleEnum,
})

export type UpdateUserRoleInput = z.infer<typeof UpdateUserRoleSchema>

export const UpdateUserPermissionsSchema = z.object({
  modulePermissions: z.array(z.string()),
})

export type UpdateUserPermissionsInput = z.infer<typeof UpdateUserPermissionsSchema>

export const UpdateUserProfileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  phone: optionalText(30),
  department: optionalText(100),
  position: optionalText(100),
})

export type UpdateUserProfileInput = z.infer<typeof UpdateUserProfileSchema>

// ─── Inventory / Spare Parts ───────────────────────────────────────────────────

export const SparePartSchema = z.object({
  partNumber: z.string().max(50),
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(1000).optional().or(z.literal("")),
  category: z.enum([
    "TONER",
    "DRUM",
    "DEVELOPER",
    "FUSER",
    "MAINTENANCE_KIT",
    "ROLLER",
    "LAPTOP_PART",
    "DESKTOP_PART",
    "CCTV_PART",
    "PROJECTOR_PART",
    "GENERAL",
  ]),
  brand: z.string().min(1, "Brand is required").max(100),
  supplier: z.string().max(150).optional().or(z.literal("")),
  compatibleWith: z.string().max(300).optional().or(z.literal("")),
  unit: z.string().max(20).default("pcs"),
  unitCost: z.coerce.number().min(0, "Must be ≥ 0").default(0),
  sellingPrice: z.coerce.number().min(0, "Must be ≥ 0").default(0),
  reorderLevel: z.coerce.number().int().min(0).default(0),
  location: z.string().max(100).optional().or(z.literal("")),
  quantity: z.coerce.number().int().min(0).default(0),
})

export type SparePartInput = z.infer<typeof SparePartSchema>

// ─── Stock Movement ─────────────────────────────────────────────────────────────

export const StockMovementSchema = z
  .object({
    type: z.enum(["IN", "OUT", "RETURN", "DAMAGE", "ADJUSTMENT"]),
    quantity: z.coerce.number().int(),
    date: z.string().optional().or(z.literal("")),
    reference: z.string().max(100).optional().or(z.literal("")),
    remark: z.string().max(500).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.type === "ADJUSTMENT") {
      if (data.quantity < 0) {
        ctx.addIssue({ code: "custom", path: ["quantity"], message: "Quantity cannot be negative" })
      }
    } else if (data.quantity < 1) {
      ctx.addIssue({ code: "custom", path: ["quantity"], message: "Quantity must be at least 1" })
    }
  })

export type StockMovementInput = z.infer<typeof StockMovementSchema>

// ─── Ledger: Income & Expense Book ─────────────────────────────────────────────

const NEW_CATEGORY_VALUE = "__new__"

export const LedgerEntrySchema = z
  .object({
    type: z.enum(["INCOME", "EXPENSE"]),
    categoryId: z.string().min(1, "Category is required"),
    newCategoryName: z.string().max(60).optional().or(z.literal("")),
    date: z.string().min(1, "Date is required"),
    amount: z.coerce.number().positive("Amount must be greater than 0"),
    paymentMethod: z.enum(["MPESA", "BANK_TRANSFER", "CHEQUE", "CASH"]),
    referenceNo: z.string().max(100).optional().or(z.literal("")),
    remark: z.string().max(500).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.categoryId === NEW_CATEGORY_VALUE && !data.newCategoryName?.trim()) {
      ctx.addIssue({ code: "custom", path: ["newCategoryName"], message: "Category name is required" })
    }
  })

export type LedgerEntryInput = z.infer<typeof LedgerEntrySchema>

// ─── Ledger: Sales Ledger ───────────────────────────────────────────────────────

export const SalesLedgerEntrySchema = z
  .object({
    date: z.string().min(1, "Date is required"),
    customerName: z.string().min(1, "Customer name is required").max(150),
    orderNo: z.string().max(100).optional().or(z.literal("")),
    invoiceAmount: z.coerce.number().min(0, "Must be ≥ 0"),
    amountReceived: z.coerce.number().min(0, "Must be ≥ 0").default(0),
    remark: z.string().max(500).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.amountReceived > data.invoiceAmount) {
      ctx.addIssue({ code: "custom", path: ["amountReceived"], message: "Cannot exceed invoice amount" })
    }
  })

export type SalesLedgerEntryInput = z.infer<typeof SalesLedgerEntrySchema>

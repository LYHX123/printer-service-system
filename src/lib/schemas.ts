import { z } from "zod"
import { DEFAULT_VAT_PERCENT } from "@/lib/constants"

// ─── Customer ─────────────────────────────────────────────────────────────────

export const CustomerSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  companyName: z.string().max(100).optional().or(z.literal("")),
  phone: z.string().min(1, "Phone is required").max(30),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
})

export type CustomerInput = z.infer<typeof CustomerSchema>

// ─── Branch ───────────────────────────────────────────────────────────────────

export const BranchSchema = z.object({
  name: z.string().min(1, "Branch name is required").max(100),
  address: z.string().max(500).optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  contactPerson: z.string().max(100).optional().or(z.literal("")),
  isPrimary: z.boolean().default(false),
})

export type BranchInput = z.infer<typeof BranchSchema>

// ─── Equipment ────────────────────────────────────────────────────────────────

export const EquipmentSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  branchId: z.string().optional().or(z.literal("")),
  serialNumber: z.string().min(1, "Serial number is required").max(100),
  assetNumber: z.string().max(100).optional().or(z.literal("")),
  brand: z.string().min(1, "Brand is required").max(100),
  model: z.string().min(1, "Model is required").max(100),
  type: z.enum([
    "PRINTER",
    "COPIER",
    "LAPTOP",
    "DESKTOP_COMPUTER",
    "PROJECTOR",
    "CCTV_SYSTEM",
    "OTHER",
  ]),
  purchaseDate: z.string().optional().or(z.literal("")),
  warrantyExpiry: z.string().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
  // Meter reading fields — only used for PRINTER/COPIER on registration
  initialBlackPages: z.coerce.number().int().min(0).optional(),
  initialColorPages: z.coerce.number().int().min(0).optional(),
})

export type EquipmentInput = z.infer<typeof EquipmentSchema>

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
  description: z.string().min(1, "Description required").max(500),
  quantity: z.coerce.number().int().min(1, "Min 1"),
  unitPrice: z.coerce.number().min(0, "Must be ≥ 0"),
})

export type QuotationItemInput = z.infer<typeof QuotationItemInputSchema>

export const QuotationSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  branchId: z.string().optional().or(z.literal("")),
  equipmentId: z.string().optional().or(z.literal("")),
  serviceType: z.enum([
    "REPAIR",
    "MAINTENANCE",
    "UPGRADE",
    "REFURBISHMENT",
    "INSTALLATION",
    "INSPECTION",
  ]),
  validUntil: z.string().optional().or(z.literal("")),
  problemDesc: z.string().min(1, "Problem description is required").max(2000),
  labourCost: z.coerce.number().min(0).default(0),
  diagnosisFee: z.coerce.number().min(0).default(0),
  transportFee: z.coerce.number().min(0).default(0),
  vatPercent: z.coerce.number().min(0).max(100).default(DEFAULT_VAT_PERCENT),
  discountAmount: z.coerce.number().min(0).default(0),
  remarks: z.string().max(2000).optional().or(z.literal("")),
  internalNotes: z.string().max(2000).optional().or(z.literal("")),
  items: z.array(QuotationItemInputSchema).default([]),
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

export const CreateUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email").max(150),
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
  role: RoleEnum,
})

export type CreateUserInput = z.infer<typeof CreateUserSchema>

export const UpdateUserRoleSchema = z.object({
  role: RoleEnum,
})

export type UpdateUserRoleInput = z.infer<typeof UpdateUserRoleSchema>

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

import { prisma } from "@/lib/prisma"
import type {
  Equipment,
  Customer,
  CustomerBranch,
  MeterReading,
  ServiceJob,
  Quotation,
  EquipmentType,
  User,
} from "@/types"

export type EquipmentListItem = Equipment & {
  customer: Pick<Customer, "id" | "name" | "code" | "companyName">
  branch: Pick<CustomerBranch, "id" | "name"> | null
  _count: { serviceJobs: number }
}

export async function getEquipmentList(
  companyId: string,
  opts?: {
    search?: string
    type?: EquipmentType
    customerId?: string
  }
): Promise<EquipmentListItem[]> {
  const { search, type, customerId } = opts ?? {}
  return prisma.equipment.findMany({
    where: {
      companyId,
      ...(type ? { type } : {}),
      ...(customerId ? { customerId } : {}),
      ...(search
        ? {
            OR: [
              { serialNumber: { contains: search, mode: "insensitive" } },
              { brand: { contains: search, mode: "insensitive" } },
              { model: { contains: search, mode: "insensitive" } },
              { assetNumber: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      customer: { select: { id: true, name: true, code: true, companyName: true } },
      branch: { select: { id: true, name: true } },
      _count: { select: { serviceJobs: true } },
    },
    orderBy: { createdAt: "desc" },
  }) as Promise<EquipmentListItem[]>
}

export type EquipmentDetail = Equipment & {
  customer: Pick<Customer, "id" | "name" | "code" | "companyName" | "phone">
  branch: Pick<CustomerBranch, "id" | "name" | "address"> | null
  meterReadings: (MeterReading & {
    recordedBy: Pick<User, "id" | "name">
    job: Pick<ServiceJob, "id" | "jobNumber"> | null
  })[]
  serviceJobs: (Pick<
    ServiceJob,
    | "id"
    | "jobNumber"
    | "status"
    | "serviceType"
    | "priority"
    | "receivedDate"
    | "completedAt"
    | "warrantyExpires"
  > & {
    assignedTo: Pick<User, "id" | "name">
  })[]
  quotations: Pick<Quotation, "id" | "quotationNumber" | "status" | "serviceType" | "totalCost" | "createdAt">[]
}

export async function getEquipment(
  id: string,
  companyId: string
): Promise<EquipmentDetail | null> {
  return prisma.equipment.findFirst({
    where: { id, companyId },
    include: {
      customer: {
        select: { id: true, name: true, code: true, companyName: true, phone: true },
      },
      branch: { select: { id: true, name: true, address: true } },
      meterReadings: {
        include: {
          recordedBy: { select: { id: true, name: true } },
          job: { select: { id: true, jobNumber: true } },
        },
        orderBy: { readingDate: "desc" },
      },
      serviceJobs: {
        select: {
          id: true,
          jobNumber: true,
          status: true,
          serviceType: true,
          priority: true,
          receivedDate: true,
          completedAt: true,
          warrantyExpires: true,
          assignedTo: { select: { id: true, name: true } },
        },
        orderBy: { receivedDate: "desc" },
      },
      quotations: {
        select: {
          id: true,
          quotationNumber: true,
          status: true,
          serviceType: true,
          totalCost: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  }) as Promise<EquipmentDetail | null>
}

export async function getEquipmentForEdit(
  id: string,
  companyId: string
): Promise<Equipment | null> {
  return prisma.equipment.findFirst({
    where: { id, companyId },
  })
}

/** All equipment for a specific customer (for job form cascade) */
export async function getCustomerEquipment(
  customerId: string,
  companyId: string
): Promise<Pick<Equipment, "id" | "brand" | "model" | "serialNumber" | "type">[]> {
  return prisma.equipment.findMany({
    where: { customerId, companyId },
    select: { id: true, brand: true, model: true, serialNumber: true, type: true },
    orderBy: { brand: "asc" },
  })
}

/** All equipment for company — lightweight, for dropdowns */
export async function getAllEquipmentForCompany(
  companyId: string
): Promise<Pick<Equipment, "id" | "brand" | "model" | "serialNumber" | "type" | "customerId">[]> {
  return prisma.equipment.findMany({
    where: { companyId },
    select: {
      id: true,
      brand: true,
      model: true,
      serialNumber: true,
      type: true,
      customerId: true,
    },
    orderBy: { brand: "asc" },
  })
}

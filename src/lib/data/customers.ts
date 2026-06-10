import { prisma } from "@/lib/prisma"
import type { Customer, CustomerBranch, Equipment, ServiceJob, Quotation } from "@/types"

export type CustomerListItem = Pick<
  Customer,
  "id" | "code" | "name" | "companyName" | "phone" | "email" | "createdAt"
> & {
  _count: { equipment: number; serviceJobs: number }
}

export async function getCustomers(
  companyId: string,
  search?: string
): Promise<CustomerListItem[]> {
  return prisma.customer.findMany({
    where: {
      companyId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { code: { contains: search, mode: "insensitive" } },
              { companyName: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      code: true,
      name: true,
      companyName: true,
      phone: true,
      email: true,
      createdAt: true,
      _count: { select: { equipment: true, serviceJobs: true } },
    },
    orderBy: { createdAt: "desc" },
  })
}

export type CustomerDetail = Customer & {
  branches: CustomerBranch[]
  equipment: (Equipment & { branch: Pick<CustomerBranch, "id" | "name"> | null })[]
  serviceJobs: (Pick<
    ServiceJob,
    "id" | "jobNumber" | "status" | "serviceType" | "priority" | "receivedDate"
  > & {
    equipment: Pick<Equipment, "id" | "brand" | "model" | "type">
  })[]
  quotations: (Pick<
    Quotation,
    "id" | "quotationNumber" | "status" | "serviceType" | "totalCost" | "createdAt"
  > & {
    equipment: Pick<Equipment, "id" | "brand" | "model" | "type"> | null
  })[]
}

export async function getCustomer(
  id: string,
  companyId: string
): Promise<CustomerDetail | null> {
  return prisma.customer.findFirst({
    where: { id, companyId },
    include: {
      branches: {
        orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
      },
      equipment: {
        include: {
          branch: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      serviceJobs: {
        select: {
          id: true,
          jobNumber: true,
          status: true,
          serviceType: true,
          priority: true,
          receivedDate: true,
          equipment: {
            select: { id: true, brand: true, model: true, type: true },
          },
        },
        orderBy: { receivedDate: "desc" },
        take: 50,
      },
      quotations: {
        select: {
          id: true,
          quotationNumber: true,
          status: true,
          serviceType: true,
          totalCost: true,
          createdAt: true,
          equipment: {
            select: { id: true, brand: true, model: true, type: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  }) as Promise<CustomerDetail | null>
}

export async function getCustomerForEdit(
  id: string,
  companyId: string
): Promise<Customer | null> {
  return prisma.customer.findFirst({
    where: { id, companyId },
  })
}

/** For forms: customers with their active branches */
export async function getCustomersWithBranches(
  companyId: string
): Promise<
  {
    id: string
    name: string
    code: string
    companyName: string | null
    branches: { id: string; name: string }[]
  }[]
> {
  return prisma.customer.findMany({
    where: { companyId },
    select: {
      id: true,
      name: true,
      code: true,
      companyName: true,
      branches: {
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
      },
    },
    orderBy: { name: "asc" },
  })
}

/** Lightweight list for dropdowns */
export async function getCustomerOptions(
  companyId: string
): Promise<Pick<Customer, "id" | "name" | "code" | "companyName">[]> {
  return prisma.customer.findMany({
    where: { companyId },
    select: { id: true, name: true, code: true, companyName: true },
    orderBy: { name: "asc" },
  })
}

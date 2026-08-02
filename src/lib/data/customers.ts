import { prisma } from "@/lib/prisma"
import type { Customer } from "@/types"

export type CustomerListItem = Pick<
  Customer,
  "id" | "code" | "companyName" | "pinNumber" | "name" | "phone" | "location" | "isActive"
> & {
  projectCount: number
  documentCount: number
}

export async function getCustomers(
  companyId: string,
  search?: string
): Promise<CustomerListItem[]> {
  const rows = await prisma.customer.findMany({
    where: {
      companyId,
      isActive: true,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { code: { contains: search, mode: "insensitive" } },
              { companyName: { contains: search, mode: "insensitive" } },
              { pinNumber: { contains: search, mode: "insensitive" } },
              {
                branches: {
                  some: {
                    isActive: true,
                    OR: [
                      { name: { contains: search, mode: "insensitive" } },
                      { contactPerson: { contains: search, mode: "insensitive" } },
                      { phone: { contains: search, mode: "insensitive" } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      code: true,
      companyName: true,
      pinNumber: true,
      name: true,
      phone: true,
      location: true,
      isActive: true,
      _count: {
        select: {
          branches: { where: { isActive: true } },
          documents: true,
        },
      },
    },
    orderBy: { companyName: "asc" },
  })

  return rows.map((r) => ({
    ...r,
    projectCount: r._count.branches,
    documentCount: r._count.documents,
  }))
}

export async function getCustomerForEdit(
  id: string,
  companyId: string
): Promise<Customer | null> {
  return prisma.customer.findFirst({
    where: { id, companyId },
  })
}

export interface CustomerDetail {
  id: string
  code: string
  companyName: string
  pinNumber: string | null
  name: string | null
  phone: string | null
  location: string | null
  email: string | null
  notes: string | null
  isActive: boolean
}

/** Full record for the Customer detail page (Company Info + Head Office Contact sections). */
export async function getCustomerDetail(
  id: string,
  companyId: string
): Promise<CustomerDetail | null> {
  return prisma.customer.findFirst({
    where: { id, companyId },
    select: {
      id: true,
      code: true,
      companyName: true,
      pinNumber: true,
      name: true,
      phone: true,
      location: true,
      email: true,
      notes: true,
      isActive: true,
    },
  })
}

/** For forms: customers with their active branches (Project picker) */
export async function getCustomersWithBranches(companyId: string): Promise<
  {
    id: string
    name: string | null
    code: string
    companyName: string
    pinNumber: string | null
    phone: string | null
    location: string | null
    email: string | null
    branches: {
      id: string
      name: string
      contactPerson: string | null
      phone: string | null
      contactEmail: string | null
      address: string | null
    }[]
  }[]
> {
  return prisma.customer.findMany({
    where: { companyId, isActive: true },
    select: {
      id: true,
      name: true,
      code: true,
      companyName: true,
      pinNumber: true,
      phone: true,
      location: true,
      email: true,
      branches: {
        where: { isActive: true },
        select: { id: true, name: true, contactPerson: true, phone: true, contactEmail: true, address: true },
        orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
      },
    },
    orderBy: { companyName: "asc" },
  })
}

/** Lightweight list for dropdowns */
export async function getCustomerOptions(
  companyId: string
): Promise<Pick<Customer, "id" | "name" | "code" | "companyName" | "pinNumber">[]> {
  return prisma.customer.findMany({
    where: { companyId, isActive: true },
    select: { id: true, name: true, code: true, companyName: true, pinNumber: true },
    orderBy: { companyName: "asc" },
  })
}

/** A single Project/Branch, even if inactive — used to re-populate a Quotation's
 * historical selection when the Project has since been deactivated. */
export async function getCustomerBranchById(id: string, companyId: string) {
  return prisma.customerBranch.findFirst({
    where: { id, companyId },
    select: { id: true, name: true, contactPerson: true, phone: true, contactEmail: true, address: true, isActive: true },
  })
}

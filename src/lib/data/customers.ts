import { prisma } from "@/lib/prisma"
import type { Customer } from "@/types"

export type CustomerListItem = Pick<
  Customer,
  "id" | "code" | "companyName" | "pinNumber" | "name" | "phone" | "location" | "isActive"
>

export async function getCustomers(
  companyId: string,
  search?: string
): Promise<CustomerListItem[]> {
  return prisma.customer.findMany({
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
    },
    orderBy: { companyName: "asc" },
  })
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
    name: string | null
    code: string
    companyName: string
    pinNumber: string | null
    branches: { id: string; name: string }[]
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
      branches: {
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
      },
    },
    orderBy: { companyName: "asc" },
  })
}

/** Lightweight list for dropdowns */
export async function getCustomerOptions(
  companyId: string
): Promise<Pick<Customer, "id" | "name" | "code" | "companyName">[]> {
  return prisma.customer.findMany({
    where: { companyId, isActive: true },
    select: { id: true, name: true, code: true, companyName: true },
    orderBy: { companyName: "asc" },
  })
}

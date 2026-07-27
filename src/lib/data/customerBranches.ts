import { prisma } from "@/lib/prisma"

export interface CustomerBranchDetail {
  id: string
  name: string
  address: string | null
  phone: string | null
  contactPerson: string | null
  contactEmail: string | null
  notes: string | null
  isPrimary: boolean
  isActive: boolean
}

/** All Projects (active and inactive) for the Customer detail page. */
export async function getCustomerBranches(
  customerId: string,
  companyId: string
): Promise<CustomerBranchDetail[]> {
  return prisma.customerBranch.findMany({
    where: { customerId, companyId },
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      contactPerson: true,
      contactEmail: true,
      notes: true,
      isPrimary: true,
      isActive: true,
    },
    orderBy: [{ isActive: "desc" }, { isPrimary: "desc" }, { name: "asc" }],
  })
}

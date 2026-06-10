import { prisma } from "@/lib/prisma"
import type {
  ServiceJob,
  Customer,
  CustomerBranch,
  Equipment,
  User,
  JobStatusLog,
  MeterReading,
  JobPhoto,
  JobStatus,
  Priority,
} from "@/types"

export type JobListItem = Pick<
  ServiceJob,
  | "id"
  | "jobNumber"
  | "status"
  | "serviceType"
  | "priority"
  | "receivedDate"
  | "dueDate"
> & {
  customer: Pick<Customer, "id" | "name" | "code">
  equipment: Pick<Equipment, "id" | "brand" | "model" | "type">
  assignedTo: Pick<User, "id" | "name">
}

export async function getJobs(
  companyId: string,
  opts?: {
    search?: string
    status?: JobStatus
    priority?: Priority
    assignedToId?: string
  }
): Promise<JobListItem[]> {
  const { search, status, priority, assignedToId } = opts ?? {}
  return prisma.serviceJob.findMany({
    where: {
      companyId,
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(assignedToId ? { assignedToId } : {}),
      ...(search
        ? {
            OR: [
              { jobNumber: { contains: search, mode: "insensitive" } },
              { customer: { name: { contains: search, mode: "insensitive" } } },
              {
                equipment: {
                  OR: [
                    { brand: { contains: search, mode: "insensitive" } },
                    { model: { contains: search, mode: "insensitive" } },
                    { serialNumber: { contains: search, mode: "insensitive" } },
                  ],
                },
              },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      jobNumber: true,
      status: true,
      serviceType: true,
      priority: true,
      receivedDate: true,
      dueDate: true,
      customer: { select: { id: true, name: true, code: true } },
      equipment: { select: { id: true, brand: true, model: true, type: true } },
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: { receivedDate: "desc" },
  }) as Promise<JobListItem[]>
}

export type JobDetail = ServiceJob & {
  customer: Pick<Customer, "id" | "name" | "code" | "companyName" | "phone" | "email">
  branch: Pick<CustomerBranch, "id" | "name" | "address"> | null
  equipment: Pick<
    Equipment,
    "id" | "brand" | "model" | "serialNumber" | "type" | "warrantyExpiry"
  >
  assignedTo: Pick<User, "id" | "name" | "email">
  createdBy: Pick<User, "id" | "name">
  statusLogs: (JobStatusLog & { changedBy: Pick<User, "id" | "name"> })[]
  meterReadings: (MeterReading & { recordedBy: Pick<User, "id" | "name"> })[]
  photos: (JobPhoto & { uploadedBy: Pick<User, "id" | "name"> })[]
}

export async function getJob(
  id: string,
  companyId: string
): Promise<JobDetail | null> {
  return prisma.serviceJob.findFirst({
    where: { id, companyId },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          code: true,
          companyName: true,
          phone: true,
          email: true,
        },
      },
      branch: { select: { id: true, name: true, address: true } },
      equipment: {
        select: {
          id: true,
          brand: true,
          model: true,
          serialNumber: true,
          type: true,
          warrantyExpiry: true,
        },
      },
      assignedTo: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
      statusLogs: {
        include: { changedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
      meterReadings: {
        include: { recordedBy: { select: { id: true, name: true } } },
        orderBy: { readingDate: "desc" },
      },
      photos: {
        include: { uploadedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  }) as Promise<JobDetail | null>
}

export async function getEngineers(
  companyId: string
): Promise<Pick<User, "id" | "name" | "email" | "role">[]> {
  return prisma.user.findMany({
    where: {
      companyId,
      isActive: true,
      role: { in: ["ENGINEER", "MANAGER", "ADMIN"] },
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  })
}

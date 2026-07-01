import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { canAccess } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import type { Role } from "@/types"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canAccess(session.user.role as Role, "ledger")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const companyId = session.user.companyId as string
  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")?.trim() ?? ""

  if (!q) return NextResponse.json({ customers: [] })

  const customers = await prisma.customer.findMany({
    where: {
      companyId,
      isActive: true,
      OR: [
        { companyName: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { code: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, companyName: true, name: true, code: true },
    orderBy: { companyName: "asc" },
    take: 10,
  })

  return NextResponse.json({ customers })
}

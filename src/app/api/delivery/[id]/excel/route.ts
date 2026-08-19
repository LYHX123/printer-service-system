import { readFile } from "fs/promises"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getDeliveryForPdf } from "@/lib/data/deliveries"
import { canAccess } from "@/lib/permissions"
import { generateDeliveryExcel, DeliveryExcelError } from "@/lib/deliveryExcel"
import type { Role } from "@/types"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canAccess(session.user.role as Role, "delivery", session.user.modulePermissions)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const companyId = session.user.companyId as string
  const { id } = await params

  const delivery = await getDeliveryForPdf(id, companyId)
  if (!delivery) {
    return NextResponse.json({ error: "Delivery not found" }, { status: 404 })
  }

  let outputPath: string
  try {
    outputPath = await generateDeliveryExcel(delivery)
  } catch (error) {
    if (error instanceof DeliveryExcelError) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    throw error
  }

  const buffer = await readFile(outputPath)
  const fileName = `${delivery.deliveryNumber}.xlsx`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  })
}

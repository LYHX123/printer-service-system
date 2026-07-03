"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canCreateQuotation } from "@/lib/permissions"
import { GenerateInvoiceSchema } from "@/lib/schemas"
import { computeSalesLedgerStatus } from "@/lib/ledger-utils"
import type { GenerateInvoiceInput } from "@/lib/schemas"
import type { Role } from "@/types"

export async function generateInvoice(quotationId: string, data: GenerateInvoiceInput) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!canCreateQuotation(session.user.role as Role)) return { error: "Forbidden" }
  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  const parsed = GenerateInvoiceSchema.safeParse(data)
  if (!parsed.success) return { error: "Invalid form data" }
  const { invoiceNumber, date, customerPin, vatPercent } = parsed.data

  let invoiceId: string
  try {
    // Invoices can be generated from a quotation at any status — generation never
    // changes the quotation's own status (that remains a separate, user-driven action).
    const quotation = await prisma.quotation.findFirst({
      where: { id: quotationId, companyId },
      include: {
        customer: { select: { id: true, companyName: true } },
        items: { include: { part: { select: { id: true, name: true, brand: true, unit: true } } } },
      },
    })
    if (!quotation) return { error: "Quotation not found" }

    const existingNumber = await prisma.invoice.findUnique({ where: { invoiceNumber } })
    if (existingNumber) return { error: "Invoice number already in use" }

    const subtotal = Number(quotation.subtotal)
    const vatAmount = (subtotal * vatPercent) / 100
    const totalAmount = subtotal + vatAmount
    const invoiceDate = new Date(`${date}T12:00:00`)

    const invoice = await prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          invoiceNumber,
          companyId,
          quotationId,
          customerId: quotation.customerId,
          customerPin: customerPin || null,
          date: invoiceDate,
          subtotal,
          vatPercent,
          vatAmount,
          totalAmount,
          createdById: userId,
          items: {
            create: quotation.items.map((item) => ({
              partId: item.partId,
              description: item.part
                ? [item.part.brand, item.part.name].filter(Boolean).join(" ")
                : (item.description ?? ""),
              unit: item.part?.unit ?? null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              amount: item.subtotal,
            })),
          },
        },
        select: { id: true },
      })

      // Optional: mirror the invoice into the Sales Ledger as a fresh unpaid entry.
      const { balance, status } = computeSalesLedgerStatus(totalAmount, 0)
      await tx.salesLedgerEntry.create({
        data: {
          companyId,
          date: invoiceDate,
          customerName: quotation.customer.companyName,
          customerId: quotation.customerId,
          orderNo: invoiceNumber,
          invoiceAmount: totalAmount,
          amountReceived: 0,
          balance,
          paymentStatus: status,
          remark: `Invoice ${invoiceNumber} for Quotation ${quotation.quotationNumber}`,
          createdById: userId,
        },
      })

      return created
    })

    invoiceId = invoice.id

    revalidatePath(`/quotations/${quotationId}`)
    revalidatePath("/quotations/invoices")
    revalidatePath("/ledger/sales")
  } catch (err) {
    console.error("generateInvoice failed:", err)
    return { error: "Failed to generate invoice" }
  }

  redirect(`/quotations/invoices/${invoiceId}`)
}

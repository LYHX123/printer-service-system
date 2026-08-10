import type { SalesPaymentStatus } from "@/types"

/** Balance = Invoice Amount − Amount Received. Status derives from the same two figures. */
export function computeSalesLedgerStatus(
  invoiceAmount: number,
  amountReceived: number
): { balance: number; status: SalesPaymentStatus } {
  const balance = invoiceAmount - amountReceived
  const status: SalesPaymentStatus = balance <= 0 ? "PAID" : amountReceived > 0 ? "PARTIAL" : "UNPAID"
  return { balance, status }
}

/**
 * The single "Invoice No" a Sales Ledger row shows anywhere (list, detail, export).
 * Invoice-generated rows (invoiceId set) always defer to the linked Invoice's own
 * business number — the live source of truth — never the `orderNo` snapshot copied
 * at creation time, which can go stale if the Invoice is later renumbered. Manual
 * rows (no linked Invoice) fall back to their own `orderNo` field.
 */
export function resolveSalesLedgerInvoiceNo(entry: {
  orderNo: string | null
  invoice: { invoiceNumber: string } | null
}): string | null {
  return entry.invoice?.invoiceNumber ?? entry.orderNo ?? null
}

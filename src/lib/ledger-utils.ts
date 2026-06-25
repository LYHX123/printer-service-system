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

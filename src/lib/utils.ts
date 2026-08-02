import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { DEFAULT_CURRENCY } from "@/lib/constants"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | string, currency: string = DEFAULT_CURRENCY): string {
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount))
  return `${currency} ${formatted}`
}

/**
 * Today's date as YYYY-MM-DD in the CALLER's local timezone — not UTC. Using
 * `new Date().toISOString().slice(0, 10)` shifts to UTC first and can show
 * yesterday's or tomorrow's date depending on the caller's timezone/time of
 * day; this reads the local calendar fields directly instead.
 *
 * Only meaningful when called in the browser (the user's actual local time) —
 * calling it in a Server Component would use the server's timezone, not the
 * visiting user's, so date-default fields should compute this client-side
 * (e.g. in a useEffect after mount) rather than passing it down as a prop
 * computed on the server.
 */
export function todayLocalDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function generateJobNumber(sequence: number): string {
  const year = new Date().getFullYear()
  return `JOB-${year}${String(sequence).padStart(4, "0")}`
}

export function generateCustomerCode(sequence: number): string {
  return `CUST-${String(sequence).padStart(4, "0")}`
}

export function generateQuotationNumber(date: Date, sequence: number): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  return `QT${year}${month}-${String(sequence).padStart(3, "0")}`
}

export function generatePartNumber(sequence: number): string {
  return `PRT-${String(sequence).padStart(5, "0")}`
}

export function generateInvoiceNumber(date: Date, sequence: number): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  return `INV${year}${month}-${String(sequence).padStart(3, "0")}`
}

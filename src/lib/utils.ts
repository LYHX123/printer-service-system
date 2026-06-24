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

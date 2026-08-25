import { formatCurrency } from "@/lib/utils"
import { cn } from "@/lib/utils"

interface AppMoneyValueProps {
  amount: number | string
  sign?: "+" | "-" | null
  className?: string
}

// Consistent formatted-currency text — same formatCurrency() every desktop
// table already uses, just with shared App-mode styling (and an optional
// +/- sign colored green/red for income/expense-style contexts).
export function AppMoneyValue({ amount, sign, className }: AppMoneyValueProps) {
  return (
    <span
      className={cn(
        "font-semibold",
        sign === "+" ? "text-green-700" : sign === "-" ? "text-red-700" : "text-slate-900",
        className
      )}
    >
      {sign ?? ""}
      {formatCurrency(amount)}
    </span>
  )
}

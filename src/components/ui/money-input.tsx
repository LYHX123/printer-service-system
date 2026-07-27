import { forwardRef, type KeyboardEvent } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// Keys that would let a user type a negative number, exponent notation, or a
// second decimal point into a native number input — blocked at keystroke time
// as a UX nicety. Final validation still happens via zod on submit.
const BLOCKED_KEYS = new Set(["-", "+", "e", "E"])

type MoneyInputProps = Omit<React.ComponentProps<typeof Input>, "type">

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ className, onKeyDown, ...props }, ref) => {
    function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
      if (BLOCKED_KEYS.has(event.key)) {
        event.preventDefault()
      }
      onKeyDown?.(event)
    }

    return (
      <Input
        ref={ref}
        type="number"
        min={0}
        step="0.01"
        inputMode="decimal"
        placeholder="0.00"
        onKeyDown={handleKeyDown}
        className={cn("no-spinner", className)}
        {...props}
      />
    )
  }
)

MoneyInput.displayName = "MoneyInput"

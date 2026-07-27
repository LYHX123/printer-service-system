import { forwardRef, useRef, type FocusEvent, type KeyboardEvent, type MouseEvent } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// Keys that would let a user type a negative number, exponent notation, or a
// second decimal point into a native number input — blocked at keystroke time
// as a UX nicety. Final validation still happens via zod on submit.
const BLOCKED_KEYS = new Set(["-", "+", "e", "E"])

interface MoneyInputProps extends Omit<React.ComponentProps<typeof Input>, "type"> {
  /**
   * Select the entire value on focus (keyboard tab or mouse click), so
   * typing immediately replaces it instead of appending to a stale "0.00".
   * Off by default — only turn on for fields where full replacement is the
   * expected interaction (e.g. Amount Received), not for every money field.
   */
  selectOnFocus?: boolean
}

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ className, onKeyDown, onFocus, onMouseUp, selectOnFocus = false, ...props }, ref) => {
    // Tracks whether the mouseup we're about to see is the one that granted
    // focus — if so we swallow it so the browser doesn't collapse the
    // selection onFocus just made back down to a caret at the click point.
    // Subsequent clicks while already focused behave normally (place the
    // caret), which is what lets normal cursor editing resume afterward.
    const justFocusedRef = useRef(false)

    function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
      if (BLOCKED_KEYS.has(event.key)) {
        event.preventDefault()
      }
      onKeyDown?.(event)
    }

    function handleFocus(event: FocusEvent<HTMLInputElement>) {
      onFocus?.(event)
      if (selectOnFocus) {
        justFocusedRef.current = true
        event.currentTarget.select()
      }
    }

    function handleMouseUp(event: MouseEvent<HTMLInputElement>) {
      if (selectOnFocus && justFocusedRef.current) {
        event.preventDefault()
        justFocusedRef.current = false
      }
      onMouseUp?.(event)
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
        onFocus={handleFocus}
        onMouseUp={handleMouseUp}
        className={cn("no-spinner", className)}
        {...props}
      />
    )
  }
)

MoneyInput.displayName = "MoneyInput"

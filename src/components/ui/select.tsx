import { forwardRef, type SelectHTMLAttributes } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, placeholder, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            "block w-full appearance-none rounded-lg border bg-white px-3 py-2.5 pr-9 text-sm text-slate-900 sm:py-2",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
            "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
            "transition-colors",
            error ? "border-red-400 focus:ring-red-500" : "border-slate-300",
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {children}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
          <ChevronDown className="h-4 w-4" />
        </div>
      </div>
    )
  }
)

Select.displayName = "Select"

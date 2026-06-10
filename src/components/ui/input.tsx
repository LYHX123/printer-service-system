import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes, type ReactNode } from "react"
import { cn } from "@/lib/utils"

// ─── Label ────────────────────────────────────────────────────────────────────

export function Label({
  className,
  children,
  required,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label
      className={cn("block text-sm font-medium text-slate-700", className)}
      {...props}
    >
      {children}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  )
}

// ─── Input ────────────────────────────────────────────────────────────────────

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string
  icon?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, icon, ...props }, ref) => {
    return (
      <div className="relative">
        {icon && (
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            "block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900",
            "placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
            "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
            "transition-colors",
            error ? "border-red-400 focus:ring-red-500" : "border-slate-300",
            icon && "pl-9",
            className
          )}
          {...props}
        />
      </div>
    )
  }
)

Input.displayName = "Input"

// ─── FormField ────────────────────────────────────────────────────────────────

interface FormFieldProps {
  label: string
  htmlFor?: string
  required?: boolean
  error?: string
  hint?: string
  children: ReactNode
  className?: string
}

export function FormField({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} required={required}>
        {label}
      </Label>
      {children}
      {hint && !error && (
        <p className="text-xs text-slate-500">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  )
}

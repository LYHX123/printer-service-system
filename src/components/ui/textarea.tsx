import { forwardRef, type TextareaHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <div>
        <textarea
          ref={ref}
          rows={4}
          className={cn(
            "block w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-900 sm:py-2",
            "placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
            "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
            "resize-y transition-colors",
            error ? "border-red-400 focus:ring-red-500" : "border-slate-300",
            className
          )}
          {...props}
        />
      </div>
    )
  }
)

Textarea.displayName = "Textarea"

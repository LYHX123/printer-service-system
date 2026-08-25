import type { ReactNode } from "react"

interface AppEmptyStateProps {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
}

export function AppEmptyState({ icon, title, description }: AppEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-10 text-center">
      {icon && <div className="text-slate-300">{icon}</div>}
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description && <p className="text-xs text-slate-400">{description}</p>}
    </div>
  )
}

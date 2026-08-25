import type { ReactNode } from "react"

export function AppSectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{children}</h2>
}

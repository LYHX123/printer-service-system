import type { TranslationKey } from "@/lib/i18n/translations"

// Shared by the desktop Topbar's breadcrumb trail and the mobile app bar's
// single page title — one source of truth for turning a pathname into a
// human label so the two surfaces can never drift apart on wording.

const SECTION_LABEL_KEYS: Record<string, TranslationKey> = {
  dashboard: "dashboard",
  quotations: "quotations",
  customers: "customers",
  jobs: "jobs",
  inventory: "inventory",
  // URL segment is "stock" (see src/app/(dashboard)/stock/page.tsx) but the
  // module's display name/translation key is "inventory" ("Stock") — without
  // this mapping the segment falls through to the raw lowercase path segment.
  stock: "inventory",
  delivery: "delivery",
  invoice: "invoice",
  tasks: "tasks",
  ledger: "ledger",
  users: "users",
  settings: "settings",
}

const SUBSECTION_LABELS: Record<string, string> = {
  new: "New",
  edit: "Edit",
  "income-expense": "Income & Expense Book",
  sales: "Sales Ledger",
  invoices: "Invoices",
}

export function segmentLabel(seg: string, parentSeg: string | undefined, t: (key: TranslationKey) => string): string {
  // Known static subsections
  if (parentSeg && SUBSECTION_LABELS[seg]) return SUBSECTION_LABELS[seg]
  // UUID-like — dynamic route (detail page)
  if (/^[0-9a-f-]{20,}$/i.test(seg)) return "Detail"
  if (SECTION_LABEL_KEYS[seg]) return t(SECTION_LABEL_KEYS[seg])
  return seg
}

export function getBreadcrumbs(pathname: string, t: (key: TranslationKey) => string): { label: string; href: string }[] {
  const crumbs: { label: string; href: string }[] = [
    { label: "Home", href: "/dashboard" },
  ]

  const segments = pathname.split("/").filter(Boolean)
  let built = ""
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    built += `/${seg}`
    const label = segmentLabel(seg, segments[i - 1], t)
    if (built !== "/dashboard") {
      crumbs.push({ label, href: built })
    }
  }

  return crumbs
}

export function getPageTitle(pathname: string, t: (key: TranslationKey) => string): string {
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length === 0) return t("dashboard")
  const last = segments[segments.length - 1]
  const parent = segments[segments.length - 2]
  return segmentLabel(last, parent, t)
}

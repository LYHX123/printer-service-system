import { redirect } from "next/navigation"

// Top-level "Invoice" nav entry. The real Invoice list/detail pages already
// live under /quotations/invoices/** (generated from a Quotation) — this route
// exists so the sidebar has its own entry point instead of forcing users
// through the Quotations tab, without duplicating the list/detail logic.
// Permission gating happens on the destination page (invoice.view).
export default function InvoiceIndexPage() {
  redirect("/quotations/invoices")
}

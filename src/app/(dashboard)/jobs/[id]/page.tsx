import { notFound } from "next/navigation"

// The legacy Jobs module has been decommissioned — see Final Remediation
// Phase 5 (Legacy Jobs Decommission). Unreachable regardless of
// authentication, permission, or Engineer-assignment state; historical
// ServiceJob data is kept in the database but no longer exposed through
// the UI.
export default function JobDetailPage() {
  notFound()
}

import { notFound } from "next/navigation"

// The legacy Jobs module has been decommissioned — see Final Remediation
// Phase 5 (Legacy Jobs Decommission). Unreachable regardless of
// authentication or permission state.
export default function NewJobPage() {
  notFound()
}

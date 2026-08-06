import { notFound } from "next/navigation"

// The legacy Jobs module has been decommissioned — see Final Remediation
// Phase 5 (Legacy Jobs Decommission). Unreachable regardless of
// authentication, permission, or Engineer-assignment state.
export default function JobSignaturePage() {
  notFound()
}

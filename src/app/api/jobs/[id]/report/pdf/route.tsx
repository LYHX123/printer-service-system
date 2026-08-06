import { NextResponse } from "next/server"

// The legacy Jobs module has been decommissioned — see Final Remediation
// Phase 5 (Legacy Jobs Decommission). Unconditionally 404, regardless of
// authentication or permission state, so the retired feature isn't
// advertised as a live endpoint.
export async function GET() {
  return new NextResponse(null, { status: 404 })
}

/**
 * Regression test for the Invoice/Quotation/Delivery download-URL bug:
 * the documents/[fileType] redirect routes used to build their fallback
 * redirect with `new URL(path, request.url)`, which behind Docker/Caddy
 * resolves to the container's own bind address (HOSTNAME=0.0.0.0) instead
 * of the public origin the browser is talking to — producing an
 * unreachable `https://0.0.0.0:3000/...` redirect target.
 *
 * The fix (src/lib/http.ts#redirectRelative) never constructs an absolute
 * URL for these same-app redirects — it sets a relative `Location` header
 * and lets the browser resolve it against its own current origin. This
 * script asserts that contract holds and can never regress to embedding a
 * server-guessed origin (0.0.0.0, localhost:3000, or the hardcoded
 * production domain) in the Location header.
 */
import { redirectRelative } from "../src/lib/http"

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`)
  console.log(`OK: ${message}`)
}

const paths = [
  "/api/quotations/invoices/inv123/pdf",
  "/api/quotations/invoices/inv123/excel",
  "/api/quotations/quo456/pdf",
  "/api/quotations/quo456/excel",
  "/api/delivery/del789/pdf",
  "/api/delivery/del789/excel",
]

const forbidden = ["0.0.0.0", "localhost:3000", "service.enfbgroup.com"]

for (const path of paths) {
  const response = redirectRelative(path)
  const location = response.headers.get("Location")

  assert(location === path, `${path} -> Location header is exactly the relative path`)
  assert(!/^[a-z]+:\/\//i.test(location ?? ""), `${path} -> Location header is relative, not absolute`)
  for (const bad of forbidden) {
    assert(!(location ?? "").includes(bad), `${path} -> Location header does not contain "${bad}"`)
  }
  assert([307, 308].includes(response.status), `${path} -> redirect status is 307/308`)
}

console.log("\nAll download-URL regression checks passed.")

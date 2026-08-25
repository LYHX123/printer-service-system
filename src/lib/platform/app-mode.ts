import { headers } from "next/headers"

// The Capacitor Android shell (printer-service-mobile/capacitor.config.json)
// appends this token to its WebView's User-Agent via `appendUserAgent`. A
// regular mobile/desktop browser — including an installed PWA — never sends
// it, so this is a deterministic, unspoofable-by-accident signal that the
// request came from the native app shell rather than just a small viewport.
const APP_SHELL_UA_MARKER = "ENFBPrinterServiceApp"

/**
 * True when the current request came from the native ENFB Printer Service
 * Android shell. Server-only — call it in a Server Component (e.g. the root
 * layout) and pass the result down; do not re-detect on the client, since
 * the client has no independent way to read the request User-Agent header
 * that's guaranteed to match what the server already rendered.
 */
export async function isCapacitorAppRequest(): Promise<boolean> {
  const headersList = await headers()
  const userAgent = headersList.get("user-agent") ?? ""
  return userAgent.includes(APP_SHELL_UA_MARKER)
}

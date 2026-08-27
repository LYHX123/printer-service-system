import { Loader2 } from "lucide-react"

// Next.js route-segment loading boundary for everything under (dashboard) —
// without this, a slower navigation (e.g. over a real network instead of
// LAN dev) gives no feedback at all until the new page is fully ready,
// which reads as "did my tap even register?" especially inside the
// Capacitor WebView (no browser tab/throbber to hint otherwise). Same
// spinner glyph Button already uses for its own loading state, just
// centered full-page instead of inline.
export default function DashboardLoading() {
  return (
    <div className="flex h-full min-h-[50vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
    </div>
  )
}

import { NextResponse } from "next/server"
import { readFile, stat } from "fs/promises"
import path from "path"
import { auth } from "@/lib/auth"
import { authorizeUploadAccess } from "@/lib/uploadAuthorization"
import type { Role } from "@/types"

// Physical files still live under public/uploads — unchanged, not moved.
// Only this route's own URL differs from the file layout: the browser and
// every stored fileUrl/logoUrl/storageKey still say "/uploads/...", and
// src/auth.config.ts's authorized() callback rewrites that to
// "/protected-uploads/..." at the Edge, before Next's static file server
// (which serves public/** directly, unauthenticated, ahead of any app
// route) can intercept the request. See Final Remediation Phase 2 P0 fix.
const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads")

// Must never be served from Next's Route Handler cache (which defaults to
// caching GET responses by URL alone, ignoring auth state) — every response
// here is authorized per-request, per-session.
export const dynamic = "force-dynamic"

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

// This route is reachable directly (not just via the /uploads rewrite) —
// Next.js has no "internal-only" route concept, so it performs the exact
// same authentication + authorization here regardless of which URL a
// request arrived through. Nothing about its behavior may ever depend on
// "this can only be hit via the rewrite."
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params

  // Path-safety checks run before anything else — cheap, and no reason to
  // touch auth/DB for a request that's malformed regardless of who sent it.
  if (segments.some((segment) => segment === "." || segment === "..")) {
    return new NextResponse(null, { status: 404 })
  }

  const filePath = path.join(UPLOADS_ROOT, ...segments)
  if (filePath !== UPLOADS_ROOT && !filePath.startsWith(UPLOADS_ROOT + path.sep)) {
    return new NextResponse(null, { status: 404 })
  }

  const session = await auth()
  if (!session?.user) {
    return new NextResponse(null, { status: 401 })
  }

  const result = await authorizeUploadAccess(segments, {
    id: session.user.id as string,
    role: session.user.role as Role,
    companyId: session.user.companyId as string,
    modulePermissions: session.user.modulePermissions as string[],
  })
  if (!result.allowed) {
    // "not_found" covers both a genuinely missing file and a cross-company
    // one — deliberately indistinguishable, so a request can never confirm
    // another company's file exists. "denied" is a same-company permission
    // gap, which isn't a cross-company information leak.
    return new NextResponse(null, { status: result.reason === "denied" ? 403 : 404 })
  }

  try {
    const stats = await stat(filePath)
    if (!stats.isFile()) {
      return new NextResponse(null, { status: 404 })
    }

    const buffer = await readFile(filePath)
    const ext = path.extname(filePath).toLowerCase()

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": MIME_TYPES[ext] ?? "application/octet-stream",
        "Content-Length": String(stats.size),
        // "private" — this is per-user authorized content now, not a public
        // asset, so a shared/proxy cache must never serve it cross-session.
        "Cache-Control": "private, max-age=86400",
      },
    })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}

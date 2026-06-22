import { NextResponse } from "next/server"
import { readFile, stat } from "fs/promises"
import path from "path"

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads")

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params

  if (segments.some((segment) => segment === "." || segment === "..")) {
    return new NextResponse(null, { status: 404 })
  }

  const filePath = path.join(UPLOADS_ROOT, ...segments)
  if (filePath !== UPLOADS_ROOT && !filePath.startsWith(UPLOADS_ROOT + path.sep)) {
    return new NextResponse(null, { status: 404 })
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
        "Cache-Control": "public, max-age=86400",
      },
    })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}

import type { NextAuthConfig } from "next-auth"
import { NextResponse } from "next/server"

const PUBLIC_PATHS = ["/login"]

// Maps URL path prefixes to module keys used in modulePermissions
const MODULE_PATHS: Array<{ prefix: string; module: string }> = [
  { prefix: "/quotations", module: "quotations" },
  { prefix: "/customers",  module: "customers"  },
  { prefix: "/jobs",       module: "jobs"       },
  { prefix: "/stock",      module: "inventory"  },
  { prefix: "/ledger",     module: "ledger"     },
  { prefix: "/users",      module: "users"      },
  { prefix: "/settings",   module: "settings"   },
]

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl
      const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))
      const isLoggedIn = !!auth?.user

      if (isLoggedIn && (pathname === "/login" || pathname === "/")) {
        return NextResponse.redirect(new URL("/dashboard", request.nextUrl.origin))
      }
      if (!isLoggedIn && !isPublic) {
        const url = new URL("/login", request.nextUrl.origin)
        url.searchParams.set("callbackUrl", pathname)
        return NextResponse.redirect(url)
      }

      // Module-level permission check (edge-safe: reads from JWT, no DB)
      if (isLoggedIn && !isPublic) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const user = (auth as any)?.user
        const role = user?.role as string | undefined
        const permissions = (user?.modulePermissions as string[] | undefined) ?? []

        // Admin always passes; empty array = all access (backward compat)
        if (role !== "ADMIN" && permissions.length > 0) {
          const match = MODULE_PATHS.find(({ prefix }) => pathname.startsWith(prefix))
          if (match && !permissions.includes(match.module)) {
            return NextResponse.redirect(new URL("/dashboard", request.nextUrl.origin))
          }
        }
      }

      return true
    },
  },
}

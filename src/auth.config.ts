import type { NextAuthConfig } from "next-auth"
import { NextResponse } from "next/server"
import { hasAnyPermission } from "@/lib/permissions"
import type { Role } from "@/types"

const PUBLIC_PATHS = ["/login"]

// Maps URL path prefixes to the leaf-permission prefix that must be present
// (any leaf under it) for the route to be reachable. Kept in sync with
// MODULE_PREFIX in src/lib/permissions.ts.
const MODULE_PATHS: Array<{ prefix: string; permPrefix: string }> = [
  { prefix: "/quotations", permPrefix: "quotations." },
  { prefix: "/invoice",    permPrefix: "invoice."    },
  { prefix: "/customers",  permPrefix: "customers."  },
  { prefix: "/jobs",       permPrefix: "jobs"        },
  { prefix: "/stock",      permPrefix: "stock."      },
  { prefix: "/ledger",     permPrefix: "ledger."     },
  { prefix: "/users",      permPrefix: "users."      },
  { prefix: "/settings",   permPrefix: "settings."   },
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
        const role = (user?.role as Role | undefined) ?? "RECEPTIONIST"
        const permissions = (user?.modulePermissions as string[] | undefined) ?? []

        const match = MODULE_PATHS.find(({ prefix }) => pathname.startsWith(prefix))
        if (match && !hasAnyPermission(role, permissions, match.permPrefix)) {
          return NextResponse.redirect(new URL("/dashboard", request.nextUrl.origin))
        }
      }

      return true
    },
  },
}

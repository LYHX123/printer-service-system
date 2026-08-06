import type { NextAuthConfig } from "next-auth"
import { NextResponse } from "next/server"
import { hasAnyPermission } from "@/lib/permissions"
import type { Role } from "@/types"

const PUBLIC_PATHS = ["/login"]

// Maps URL path prefixes to the leaf-permission prefix that must be present
// (any leaf under it) for the route to be reachable. Kept in sync with
// MODULE_PREFIX in src/lib/permissions.ts.
//
// Order here does NOT matter — matching below always picks the longest
// (most specific) prefix that matches, not just the first array entry that
// does. This matters because /quotations/invoices/* (the real Invoice
// pages) sits *under* /quotations/* on the URL tree despite belonging to a
// different permission module: without picking the more specific match, an
// invoice.*-only user would get misclassified under the /quotations rule
// and blocked outright (see Final Remediation Phase 2 — Invoice routing
// regression). Any future module whose routes nest under another module's
// path prefix gets this same protection for free, without needing to
// remember to hand-order the array by specificity.
const MODULE_PATHS: Array<{ prefix: string; permPrefix: string }> = [
  { prefix: "/quotations/invoices", permPrefix: "invoice."    }, // real Invoice pages — nested under /quotations, must win over the rule below
  { prefix: "/quotations",          permPrefix: "quotations." },
  { prefix: "/invoice",             permPrefix: "invoice."    }, // literal /invoice is just a redirect stub to /quotations/invoices, kept for completeness
  { prefix: "/customers",           permPrefix: "customers."  },
  // "/jobs" intentionally has no entry — the legacy Jobs module has been
  // decommissioned (Final Remediation Phase 5) and every /jobs/** page now
  // calls notFound() unconditionally at the page level. Leaving a
  // permission-gated entry here would mean a permission-less caller gets
  // redirected to /dashboard before ever reaching that notFound() — reachable
  // but hidden, not actually unreachable. Removing the entry makes every
  // authenticated caller (regardless of permission) fall through to the page,
  // which then 404s unconditionally — the gate no longer depends on the
  // permission system at all.
  { prefix: "/stock",               permPrefix: "stock."      },
  { prefix: "/ledger",              permPrefix: "ledger."     },
  { prefix: "/users",               permPrefix: "users."      },
  { prefix: "/settings",            permPrefix: "settings."   },
]

/** True if `pathname` is exactly `prefix`, or a real sub-path of it — never a same-string-prefixed sibling (e.g. "/stock" must not match "/stock-other"). */
function matchesModulePath(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/** The most specific (longest-prefix) MODULE_PATHS entry matching `pathname`, or undefined if none match. */
function findModuleMatch(pathname: string): { prefix: string; permPrefix: string } | undefined {
  let best: { prefix: string; permPrefix: string } | undefined
  for (const entry of MODULE_PATHS) {
    if (matchesModulePath(pathname, entry.prefix) && (!best || entry.prefix.length > best.prefix.length)) {
      best = entry
    }
  }
  return best
}

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    // Edge-safe (no DB): projects the custom fields the `jwt` callback in the
    // full auth.ts already embedded in the encrypted token (role, companyId,
    // modulePermissions, ...) onto `session.user`. Without this, the default
    // NextAuth session shape only carries name/email/id, so `auth.user.role`
    // below was always undefined at the edge and silently fell back to the
    // "RECEPTIONIST" + [] defaults — auth.ts's own `session` callback
    // re-applies the identical projection for the Node-side auth() calls
    // (page Server Components), so this is not a behavior change there, only
    // a fix for the middleware path that only ever sees authConfig.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    session({ session, token }: any) {
      if (token) {
        session.user.id = token.id
        session.user.role = token.role
        session.user.companyId = token.companyId
        session.user.modulePermissions = token.modulePermissions ?? []
        session.user.username = token.username ?? ""
        session.user.position = token.position ?? null
      }
      return session
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl

      // Every business file under public/uploads/** is otherwise reachable
      // as an unauthenticated static asset the moment it exists on disk —
      // Next serves public/ directly, ahead of any app route, so a route
      // handler at /uploads/[...path] can never intercept it. Rewriting here
      // (Edge, no DB) forces the request through App Router resolution
      // instead of static serving; the actual session + company + module
      // permission checks all happen in
      // src/app/protected-uploads/[...path]/route.ts, which runs on the
      // Node runtime with full Prisma access. This branch does nothing else
      // — no login redirect, no MODULE_PATHS check — so there's exactly one
      // place authorization for these files is decided.
      if (pathname.startsWith("/uploads/")) {
        const url = request.nextUrl.clone()
        url.pathname = pathname.replace(/^\/uploads\//, "/protected-uploads/")
        return NextResponse.rewrite(url)
      }

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

        const match = findModuleMatch(pathname)
        if (match && !hasAnyPermission(role, permissions, match.permPrefix)) {
          return NextResponse.redirect(new URL("/dashboard", request.nextUrl.origin))
        }
      }

      return true
    },
  },
}

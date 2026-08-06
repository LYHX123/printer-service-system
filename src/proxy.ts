import NextAuth from "next-auth"
import { authConfig } from "./auth.config"

export default NextAuth(authConfig).auth

export const config = {
  matcher: [
    // "uploads" and "protected-uploads" both stay out of the normal page-auth
    // flow below (no login-page redirect, no MODULE_PATHS check) — file
    // requests get their own dedicated handling instead, see the next entry
    // and src/auth.config.ts's authorized() callback.
    "/((?!api|_next/static|_next/image|favicon.ico|uploads|protected-uploads|manifest.json|sw.js|offline.html|icons/).*)",
    // Runs this same middleware for /uploads/* too, but ONLY to rewrite it to
    // /protected-uploads/* before Next's static file server can intercept
    // it (public/uploads/** is otherwise served directly, unauthenticated,
    // bypassing any app route — see Final Remediation Phase 2 P0 fix). The
    // rewrite is unconditional and short-circuits before any auth/redirect
    // logic; all real authorization happens in
    // src/app/protected-uploads/[...path]/route.ts, which has full DB
    // access (unlike this Edge-runtime middleware).
    "/uploads/:path*",
  ],
}

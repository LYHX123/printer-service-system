import type { NextAuthConfig } from "next-auth"
import { NextResponse } from "next/server"

const PUBLIC_PATHS = ["/login"]

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
      return true
    },
  },
}

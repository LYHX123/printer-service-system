import NextAuth, { CredentialsSignin, type DefaultSession } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import type { Role } from "@/generated/prisma/client"
import { authConfig } from "@/auth.config"

const LOCK_THRESHOLD = 5
const LOCK_DURATION_MS = 30 * 60 * 1000 // 30 minutes

declare module "next-auth" {
  interface User {
    role: Role
    companyId: string
    modulePermissions: string[]
    username: string
    position: string | null
  }
  interface Session {
    user: DefaultSession["user"] & {
      id: string
      role: Role
      companyId: string
      modulePermissions: string[]
      username: string
      position: string | null
    }
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null

        const user = await prisma.user.findFirst({
          where: { username: credentials.username as string },
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            role: true,
            companyId: true,
            isActive: true,
            passwordHash: true,
            modulePermissions: true,
            failedLoginAttempts: true,
            lockedUntil: true,
            position: true,
          },
        })

        if (!user || !user.isActive) return null

        // Account lock check (expiry-based)
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          throw new CredentialsSignin("ACCOUNT_LOCKED")
        }

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        )

        if (!valid) {
          const newAttempts = (user.failedLoginAttempts ?? 0) + 1
          const shouldLock = newAttempts >= LOCK_THRESHOLD
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: newAttempts,
              ...(shouldLock
                ? { lockedUntil: new Date(Date.now() + LOCK_DURATION_MS) }
                : {}),
            },
          })
          return null
        }

        // Success — reset lockout state if needed
        if (user.failedLoginAttempts > 0 || user.lockedUntil) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockedUntil: null },
          })
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username ?? "",
          role: user.role,
          companyId: user.companyId,
          modulePermissions: user.modulePermissions,
          position: user.position ?? null,
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async jwt({ token, user }: any) {
      if (user) {
        // Initial sign-in — populate from authorize() return value
        token.id = user.id
        token.role = user.role
        token.companyId = user.companyId
        token.modulePermissions = user.modulePermissions ?? []
        token.username = user.username ?? ""
        token.position = user.position ?? null
      } else if (token.id) {
        // Subsequent requests — refresh mutable profile fields from DB
        // so edits to name/username/position are reflected without re-login
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { name: true, username: true, position: true },
        })
        if (fresh) {
          token.name = fresh.name
          token.username = fresh.username ?? ""
          token.position = fresh.position ?? null
        }
      }
      return token
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    session({ session, token }: any) {
      if (token) {
        session.user.id = token.id
        session.user.name = token.name  // explicitly pass refreshed name
        session.user.role = token.role
        session.user.companyId = token.companyId
        session.user.modulePermissions = token.modulePermissions ?? []
        session.user.username = token.username ?? ""
        session.user.position = token.position ?? null
      }
      return session
    },
  },
})

import NextAuth, { type DefaultSession } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import type { Role } from "@/generated/prisma/client"
import { authConfig } from "@/auth.config"

declare module "next-auth" {
  interface User {
    role: Role
    companyId: string
    modulePermissions: string[]
  }
  interface Session {
    user: DefaultSession["user"] & {
      id: string
      role: Role
      companyId: string
      modulePermissions: string[]
    }
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            companyId: true,
            isActive: true,
            passwordHash: true,
            modulePermissions: true,
          },
        })

        if (!user || !user.isActive) return null

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        )
        if (!valid) return null

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          companyId: user.companyId,
          modulePermissions: user.modulePermissions,
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jwt({ token, user }: any) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.companyId = user.companyId
        token.modulePermissions = user.modulePermissions ?? []
      }
      return token
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    session({ session, token }: any) {
      if (token) {
        session.user.id = token.id
        session.user.role = token.role
        session.user.companyId = token.companyId
        session.user.modulePermissions = token.modulePermissions ?? []
      }
      return session
    },
  },
})

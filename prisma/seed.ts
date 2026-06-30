import "dotenv/config"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"
import bcrypt from "bcryptjs"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const company = await prisma.company.upsert({
    where: { code: "TECHFIX" },
    update: {
      website: "https://www.techfix.com",
      kraPin: "P000000000A",
      vatPercent: 16,
      currency: "KES",
      timezone: "Africa/Nairobi",
    },
    create: {
      name: "TechFix Services",
      code: "TECHFIX",
      address: "123 Service Road, Tech City",
      phone: "+60 12-345 6789",
      email: "info@techfix.com",
      website: "https://www.techfix.com",
      kraPin: "P000000000A",
      vatPercent: 16,
      currency: "KES",
      timezone: "Africa/Nairobi",
      isActive: true,
    },
  })

  console.log(`Company: ${company.name} (${company.id})`)

  const password = await bcrypt.hash("Password123!", 12)

  const users = [
    { name: "Admin User",        username: "admin",        email: "admin@techfix.com",        role: "ADMIN" as const },
    { name: "Manager User",      username: "manager",      email: "manager@techfix.com",      role: "MANAGER" as const },
    { name: "Engineer User",     username: "engineer",     email: "engineer@techfix.com",     role: "ENGINEER" as const },
    { name: "Receptionist User", username: "receptionist", email: "receptionist@techfix.com", role: "RECEPTIONIST" as const },
  ]

  for (const u of users) {
    const created = await prisma.user.upsert({
      where: { email: u.email },
      update: { username: u.username },
      create: { companyId: company.id, name: u.name, username: u.username, email: u.email, passwordHash: password, role: u.role },
    })
    console.log(`  ${created.role}: ${created.username} (${created.email})`)
  }

  console.log("\nSeed complete. Default password for all users: Password123!")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect(); await pool.end() })

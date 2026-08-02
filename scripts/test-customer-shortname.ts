import { prisma } from "@/lib/prisma"

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true } })
  if (!company) throw new Error("no company")

  // A. Create with shortName
  const created = await prisma.customer.create({
    data: {
      companyId: company.id,
      code: "TESTSN-" + Date.now(),
      companyName: "China State Construction Engineering Corporation",
      shortName: "CSCEC",
    },
    select: { id: true, shortName: true },
  })
  console.log("A. Created with shortName:", created.shortName === "CSCEC" ? "PASS" : "FAIL", created)

  // B. Edit shortName
  const updated = await prisma.customer.update({
    where: { id: created.id },
    data: { shortName: "CHINA STATE" },
    select: { shortName: true },
  })
  console.log("B. Edited shortName:", updated.shortName === "CHINA STATE" ? "PASS" : "FAIL", updated)

  // C. Historical customer with shortName = null must not error
  const legacy = await prisma.customer.create({
    data: {
      companyId: company.id,
      code: "TESTSN2-" + Date.now(),
      companyName: "Legacy Customer With No Short Name",
      // shortName omitted entirely — simulates a pre-existing row
    },
    select: { id: true, shortName: true },
  })
  console.log("C. Legacy customer, shortName is null:", legacy.shortName === null ? "PASS" : "FAIL", legacy)

  // Cleanup
  await prisma.customer.delete({ where: { id: created.id } })
  await prisma.customer.delete({ where: { id: legacy.id } })
  console.log("\nCleaned up test customers.")
  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error("TEST FAILED:", err)
  await prisma.$disconnect()
  process.exit(1)
})

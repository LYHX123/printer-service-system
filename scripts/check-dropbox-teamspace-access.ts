/**
 * READ-ONLY diagnostic for Dropbox Team Space access — hits the real,
 * already-connected Dropbox account (does NOT run the OAuth flow, does
 * NOT call create_folder). Confirms:
 *   1. root_info from get_current_account (root vs. home namespace)
 *   2. the derived Dropbox-API-Path-Root namespace
 *   3. the configured Team Folder is visible/reachable under it
 *   4. the current contents of {DROPBOX_ROOT_PATH}
 *
 *   npx tsx -r dotenv/config scripts/check-dropbox-teamspace-access.ts
 */
import { prisma } from "@/lib/prisma"
import {
  getDropboxApiContext,
  verifyDropboxTeamFolderExists,
  dropboxApiFetch,
  getRootPath,
  getTeamFolderPath,
  DropboxFolderError,
} from "@/lib/dropbox"

async function main() {
  const company = await prisma.company.findFirst({ select: { id: true } })
  if (!company) throw new Error("No company in dev DB")

  console.log("DROPBOX_ROOT_PATH:", getRootPath())
  console.log("Derived Team Folder path:", getTeamFolderPath())

  const { accessToken, account, pathRootNamespaceId } = await getDropboxApiContext(company.id)
  console.log("\nConnected account:", account.displayName, `<${account.email}>`)
  console.log("root_info:", account.rootInfo)
  console.log(
    "root_namespace_id !== home_namespace_id:",
    account.rootInfo ? account.rootInfo.rootNamespaceId !== account.rootInfo.homeNamespaceId : "N/A"
  )
  console.log("Derived Dropbox-API-Path-Root namespace:", pathRootNamespaceId ?? "(none — using default/home namespace)")

  console.log("\n--- Team Folder accessibility check ---")
  try {
    await verifyDropboxTeamFolderExists(accessToken, pathRootNamespaceId)
    console.log("PASS — Team Folder is visible and reachable.")
  } catch (err) {
    console.log("FAILED:", err instanceof DropboxFolderError ? err.message : err)
    await prisma.$disconnect()
    return
  }

  console.log(`\n--- Current contents of "${getRootPath()}" ---`)
  try {
    const listing = await dropboxApiFetch<{ entries: { name: string; ".tag": string }[] }>(
      accessToken,
      "/files/list_folder",
      { path: getRootPath() },
      pathRootNamespaceId ?? undefined
    )
    if (listing.entries.length === 0) console.log("  (empty — not yet initialized)")
    for (const entry of listing.entries) console.log(`  [${entry[".tag"]}] ${entry.name}`)
  } catch {
    console.log("  (not created yet)")
  }

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error("CHECK FAILED:", err)
  await prisma.$disconnect()
  process.exit(1)
})

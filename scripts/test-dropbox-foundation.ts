/**
 * Standalone local test for the Dropbox Foundation module
 * (src/lib/dropbox). Does NOT hit the real Dropbox API — validates env
 * handling, token encryption round-trip, path helpers, and authorize-URL
 * construction using a locally-generated throwaway test key.
 *   npx tsx -r dotenv/config scripts/test-dropbox-foundation.ts
 */
import { randomBytes } from "crypto"

// Use a throwaway key for this test run only — never touches real .env.
process.env.DROPBOX_APP_KEY = "test_app_key_123"
process.env.DROPBOX_APP_SECRET = "test_app_secret_456"
process.env.DROPBOX_REDIRECT_URI = "http://localhost:3000/api/dropbox/callback"
process.env.DROPBOX_ROOT_PATH = "/ENFB SYSTEM FILE Team Folder/Printer Service System"
process.env.DROPBOX_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("hex")

async function main() {
  const { isDropboxConfigured, getDropboxEnvConfig } = await import("@/lib/dropbox/env")
  const { encryptToken, decryptToken } = await import("@/lib/dropbox/token")
  const { buildAuthorizeUrl, generateOAuthState } = await import("@/lib/dropbox")
  const { getRootPath, getCustomerBasePath, getQuotationBasePath, getInvoiceBasePath, getPhase1Folders } = await import(
    "@/lib/dropbox/paths"
  )

  console.log("=== A. isDropboxConfigured (with all vars set) ===")
  console.log(isDropboxConfigured() === true ? "PASS" : "FAIL")

  console.log("\n=== B. getDropboxEnvConfig ===")
  const config = getDropboxEnvConfig()
  console.log("rootPath:", config.rootPath)
  console.log(config.rootPath === "/ENFB SYSTEM FILE Team Folder/Printer Service System" ? "PASS" : "FAIL")

  console.log("\n=== C. Missing-var detection ===")
  const savedKey = process.env.DROPBOX_APP_KEY
  delete process.env.DROPBOX_APP_KEY
  const { isDropboxConfigured: check2 } = await import("@/lib/dropbox/env")
  console.log("configured with APP_KEY missing:", check2())
  console.log(check2() === false ? "PASS" : "FAIL")
  process.env.DROPBOX_APP_KEY = savedKey

  console.log("\n=== D. Token encryption round-trip ===")
  const plainToken = "sl.this-is-a-fake-refresh-token-value-1234567890"
  const encrypted = encryptToken(plainToken)
  console.log("encrypted (not the plaintext):", encrypted.slice(0, 20) + "...")
  console.log("encrypted !== plaintext:", encrypted !== plainToken)
  const decrypted = decryptToken(encrypted)
  console.log("decrypted === original:", decrypted === plainToken ? "PASS" : "FAIL")

  console.log("\n=== E. Tampered ciphertext rejected ===")
  try {
    const tampered = encrypted.slice(0, -4) + "abcd"
    decryptToken(tampered)
    console.log("FAIL — should have thrown")
  } catch (err) {
    console.log("Correctly threw:", err instanceof Error ? err.constructor.name : err)
    console.log("PASS")
  }

  console.log("\n=== F. Path helpers ===")
  console.log("getRootPath:", getRootPath())
  console.log("getCustomerBasePath:", getCustomerBasePath())
  console.log("getQuotationBasePath:", getQuotationBasePath())
  console.log("getInvoiceBasePath:", getInvoiceBasePath())
  console.log("getPhase1Folders:", getPhase1Folders())
  const expected = [
    "/ENFB SYSTEM FILE Team Folder/Printer Service System",
    "/ENFB SYSTEM FILE Team Folder/Printer Service System/Customer",
    "/ENFB SYSTEM FILE Team Folder/Printer Service System/Quotation",
    "/ENFB SYSTEM FILE Team Folder/Printer Service System/Invoice",
  ]
  console.log(JSON.stringify(getPhase1Folders()) === JSON.stringify(expected) ? "PASS" : "FAIL")

  console.log("\n=== G. Authorize URL construction ===")
  const state = generateOAuthState()
  const authUrl = buildAuthorizeUrl(state)
  console.log(authUrl)
  const parsed = new URL(authUrl)
  const checks = {
    "client_id present": parsed.searchParams.get("client_id") === "test_app_key_123",
    "redirect_uri present": parsed.searchParams.get("redirect_uri") === "http://localhost:3000/api/dropbox/callback",
    "response_type=code": parsed.searchParams.get("response_type") === "code",
    "token_access_type=offline": parsed.searchParams.get("token_access_type") === "offline",
    "state present": parsed.searchParams.get("state") === state,
    "no app_secret in URL": !authUrl.includes("test_app_secret_456"),
  }
  for (const [label, pass] of Object.entries(checks)) {
    console.log(`  ${pass ? "PASS" : "FAIL"} — ${label}`)
  }

  console.log("\n=== H. State is random per call ===")
  const state2 = generateOAuthState()
  console.log(state !== state2 ? "PASS" : "FAIL")

  console.log("\nAll Dropbox Foundation local tests complete.")
}

main().catch((err) => {
  console.error("TEST FAILED:", err)
  process.exit(1)
})

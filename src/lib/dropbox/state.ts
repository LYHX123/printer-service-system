import { randomBytes } from "crypto"

/** Name of the short-lived httpOnly cookie that carries the OAuth CSRF state between /connect and /callback. */
export const DROPBOX_OAUTH_STATE_COOKIE = "dropbox_oauth_state"

export function generateOAuthState(): string {
  return randomBytes(24).toString("hex")
}

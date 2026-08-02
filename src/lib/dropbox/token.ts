import { randomBytes, createCipheriv, createDecipheriv } from "crypto"
import { getDropboxEnvConfig } from "./env"
import { DropboxConfigurationError, DropboxAuthenticationError } from "./errors"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12

/**
 * DROPBOX_TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 raw
 * bytes) — generate one with `openssl rand -hex 32`. Never logged, never
 * stored anywhere but the environment.
 */
function getKeyBuffer(): Buffer {
  const { tokenEncryptionKey } = getDropboxEnvConfig()
  const key = Buffer.from(tokenEncryptionKey, "hex")
  if (key.length !== 32) {
    throw new DropboxConfigurationError(
      "DROPBOX_TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes) — generate one with `openssl rand -hex 32`."
    )
  }
  return key
}

/** Encrypts a Dropbox refresh token for storage. Encoded as "iv.authTag.ciphertext", all base64. */
export function encryptToken(plainText: string): string {
  const key = getKeyBuffer()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(".")
}

/** Decrypts a token previously produced by encryptToken(). Throws DropboxAuthenticationError if malformed/tampered. */
export function decryptToken(encoded: string): string {
  const key = getKeyBuffer()
  const parts = encoded.split(".")
  if (parts.length !== 3) {
    throw new DropboxAuthenticationError("Stored Dropbox token is malformed.")
  }
  const [ivB64, authTagB64, dataB64] = parts

  try {
    const iv = Buffer.from(ivB64, "base64")
    const authTag = Buffer.from(authTagB64, "base64")
    const data = Buffer.from(dataB64, "base64")
    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
    return decrypted.toString("utf8")
  } catch {
    throw new DropboxAuthenticationError("Failed to decrypt stored Dropbox token — it may have been saved with a different encryption key.")
  }
}

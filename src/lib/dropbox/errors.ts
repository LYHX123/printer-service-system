/** Base class for all Dropbox Foundation errors — never carries a token in its message. */
export class DropboxError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DropboxError"
  }
}

/** One or more required DROPBOX_* environment variables are missing. */
export class DropboxConfigurationError extends DropboxError {
  constructor(message = "Dropbox is not configured. Missing required environment variables.") {
    super(message)
    this.name = "DropboxConfigurationError"
  }
}

/** No DropboxConnection exists for this company, or it was disconnected. */
export class DropboxNotConnectedError extends DropboxError {
  constructor(message = "Dropbox is not connected.") {
    super(message)
    this.name = "DropboxNotConnectedError"
  }
}

/** OAuth state mismatch, token exchange failure, or refresh failure. */
export class DropboxAuthenticationError extends DropboxError {
  constructor(message = "Dropbox authentication failed.") {
    super(message)
    this.name = "DropboxAuthenticationError"
  }
}

/** A Dropbox API call itself returned an error response. */
export class DropboxApiError extends DropboxError {
  status?: number
  errorTag?: string

  constructor(message: string, status?: number, errorTag?: string) {
    super(message)
    this.name = "DropboxApiError"
    this.status = status
    this.errorTag = errorTag
  }
}

/** A folder-creation/lookup operation failed for a reason other than "already exists". */
export class DropboxFolderError extends DropboxError {
  constructor(message: string) {
    super(message)
    this.name = "DropboxFolderError"
  }
}

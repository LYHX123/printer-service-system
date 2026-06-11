/** Builds a `mailto:` link for the given recipient, subject and body. */
export function buildMailtoUrl(email: string, subject: string, body: string): string {
  const params = new URLSearchParams({ subject, body })
  return `mailto:${email}?${params.toString().replace(/\+/g, "%20")}`
}

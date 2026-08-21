/**
 * Redirects to a path on this same app using a relative `Location` header,
 * so the browser resolves it against whatever origin it's actually talking
 * to (http://localhost:3000 locally, https://service.enfbgroup.com in
 * production) — never a server-guessed absolute URL.
 *
 * `NextResponse.redirect()` refuses relative URLs (it requires `new
 * URL(path, base)`), and building that base from `request.url` is unsafe
 * behind Docker/Caddy: the Next.js server inside the container is bound to
 * `HOSTNAME=0.0.0.0`, and `request.url` reflects that bind address, not the
 * public domain the browser used (see the Dropbox OAuth callback route for
 * the same issue with request-derived origins). A relative `Location`
 * header is valid per RFC 9110 and every browser resolves it correctly, so
 * no origin ever needs to be computed server-side for an internal redirect.
 */
export function redirectRelative(pathname: string, status: 307 | 308 = 307): Response {
  return new Response(null, { status, headers: { Location: pathname } })
}

import { cookies } from "next/headers";
import { parseSetCookieHeader, toCookieOptions } from "better-auth/cookies";

/**
 * Applies every `Set-Cookie` header Better Auth returned from an
 * `auth.api.*` call (via `returnHeaders: true`) onto the current Next.js
 * response cookie jar.
 *
 * Server Actions cannot return a raw `Response`, so this is the supported
 * bridge between Better Auth's Fetch-standard `Headers` output and
 * `next/headers` `cookies()` (see the identity infrastructure module
 * comment in `auth.ts` — this file is one of the few places outside
 * `better-auth` itself allowed to import its runtime helpers).
 */
export async function applyAuthResponseCookies(headers: Headers): Promise<void> {
  const setCookieValues = headers.getSetCookie();
  if (setCookieValues.length === 0) return;

  const cookieStore = await cookies();
  for (const setCookieValue of setCookieValues) {
    for (const [name, attributes] of parseSetCookieHeader(setCookieValue)) {
      cookieStore.set(name, attributes.value, toCookieOptions(attributes));
    }
  }
}

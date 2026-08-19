import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/modules/identity/infrastructure/auth";

/**
 * Same-origin Better Auth route: the browser only ever talks to
 * `/api/auth/*` on Holdria's own origin, never to a separate
 * authentication service.
 */
export const { GET, POST } = toNextJsHandler(auth);

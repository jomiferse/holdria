import { smtpEmailPort } from "./smtp-email-port";
import type { EmailPort } from "./port";

export type { EmailMessage, EmailPort } from "./port";

let activePort: EmailPort = smtpEmailPort;

/** The `EmailPort` `auth.ts` sends verification/reset/security mail through. */
export function getEmailPort(): EmailPort {
  return activePort;
}

/**
 * Swaps the active `EmailPort`, for tests only (e.g. injecting
 * `TestEmailPort` so assertions don't depend on a running SMTP server).
 * Production wiring never calls this — the SMTP adapter is the default.
 */
export function setEmailPortForTesting(port: EmailPort): void {
  activePort = port;
}

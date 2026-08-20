/**
 * Provider-neutral outbound email port for identity infrastructure.
 *
 * Better Auth's verification, password-reset, and account-security
 * callbacks are wired to an adapter implementing this interface (see
 * `smtp-email-port.ts` for production and `test-email-port.ts` for tests)
 * so the mail transport can change without touching `auth.ts` callback
 * wiring or message content.
 */
export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export interface EmailPort {
  send(message: EmailMessage): Promise<void>;
}

/**
 * Fetches a verification (or other transactional) email from Mailpit, the
 * development/test SMTP server `docker-compose.yml` runs alongside
 * PostgreSQL (see README "Local development"). The running application
 * sends real mail through `smtpEmailPort` to it, so a test that reads a
 * message here is exercising the actual send-and-verify path rather than
 * writing `email_verified` into the database directly.
 */
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://localhost:8025";

interface MailpitMessageSummary {
  readonly ID: string;
}

interface MailpitSearchResponse {
  readonly messages: readonly MailpitMessageSummary[];
}

interface MailpitMessage {
  readonly Text: string;
}

/**
 * Polls Mailpit for the most recent message to `email` matching `linkPattern`
 * and returns the first matched link. Polls rather than assuming immediate
 * delivery: the application sends mail asynchronously after the sign-up
 * response, so the message may not exist in Mailpit yet at the moment this
 * is called.
 */
export async function findEmailLink(
  email: string,
  linkPattern: RegExp,
  { timeoutMs = 15_000, pollIntervalMs = 300 }: { timeoutMs?: number; pollIntervalMs?: number } = {},
): Promise<string> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const searchResponse = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    if (searchResponse.ok) {
      const { messages } = (await searchResponse.json()) as MailpitSearchResponse;
      const latest = messages[0];
      if (latest) {
        const messageResponse = await fetch(`${MAILPIT_URL}/api/v1/message/${latest.ID}`);
        if (messageResponse.ok) {
          const message = (await messageResponse.json()) as MailpitMessage;
          const match = linkPattern.exec(message.Text);
          if (match) return match[0];
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`No email matching ${linkPattern} arrived for ${email} within ${timeoutMs}ms (Mailpit at ${MAILPIT_URL})`);
}

/** Finds the emailed verification link for `email` — Better Auth's `GET /api/auth/verify-email?token=...` callback URL. */
export async function findVerificationLink(email: string): Promise<string> {
  return findEmailLink(email, /http\S*\/api\/auth\/verify-email\?token=\S+/);
}

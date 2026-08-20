import type { EmailMessage, EmailPort } from "./port";

/**
 * In-memory `EmailPort` for unit and integration tests. Records every
 * message instead of making a network call, so tests can assert on
 * verification/reset links without a real SMTP transport (task 1.5 /
 * 3.3: "reusable authenticated-user fixtures that do not depend on
 * production accounts" and "including test transport").
 */
export class TestEmailPort implements EmailPort {
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }

  last(): EmailMessage | undefined {
    return this.sent.at(-1);
  }

  clear(): void {
    this.sent.length = 0;
  }
}

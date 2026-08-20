import nodemailer from "nodemailer";

import { env } from "@/config/env";

import type { EmailMessage, EmailPort } from "./port";

/**
 * SMTP-backed `EmailPort` implementation. Points at any standard SMTP
 * server via the `SMTP_*` environment variables (design.md decision 3 and
 * 11 require a self-hostable SMTP service, never a managed email API).
 *
 * In local development and tests, `SMTP_HOST`/`SMTP_PORT` point at the
 * Mailpit service from `docker-compose.yml`, which captures outgoing mail
 * instead of delivering it.
 */
class SmtpEmailPort implements EmailPort {
  private readonly transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth:
      env.SMTP_USER && env.SMTP_PASSWORD
        ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
        : undefined,
  });

  async send(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: env.SMTP_FROM,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  }
}

export const smtpEmailPort: EmailPort = new SmtpEmailPort();

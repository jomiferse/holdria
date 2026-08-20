import type { EmailMessage } from "./port";

/**
 * Plain, dependency-free HTML/text email bodies for Better Auth's
 * verification, password-reset, and account-security callbacks. Kept
 * intentionally simple (no MJML/React-email pipeline) since this is
 * transactional security mail, not marketing content.
 */

function wrap(preheader: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="font-family: -apple-system, sans-serif; color: #0f172a; background: #f8fafc; padding: 24px;">
    <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 24px;">
      <p style="font-size: 12px; color: #64748b; margin: 0 0 16px;">${preheader}</p>
      ${bodyHtml}
      <p style="font-size: 12px; color: #94a3b8; margin-top: 24px;">Holdria</p>
    </div>
  </body>
</html>`;
}

export function verificationEmail(url: string): EmailMessage {
  return {
    to: "",
    subject: "Verify your Holdria email address",
    html: wrap(
      "Verify your email to finish creating your Holdria account.",
      `<h1 style="font-size: 18px;">Confirm your email address</h1>
       <p>Click the link below to verify your email and activate your Holdria account. This link expires in 1 hour.</p>
       <p><a href="${url}" style="color: #2563eb;">Verify email address</a></p>
       <p>If you did not create a Holdria account, you can safely ignore this message.</p>`,
    ),
    text: `Confirm your Holdria email address: ${url}\n\nThis link expires in 1 hour. If you did not create a Holdria account, you can ignore this message.`,
  };
}

export function passwordResetEmail(url: string): EmailMessage {
  return {
    to: "",
    subject: "Reset your Holdria password",
    html: wrap(
      "Use this link to choose a new Holdria password.",
      `<h1 style="font-size: 18px;">Reset your password</h1>
       <p>Click the link below to choose a new password. This link expires in 1 hour and can be used once.</p>
       <p><a href="${url}" style="color: #2563eb;">Reset password</a></p>
       <p>If you did not request a password reset, you can safely ignore this message — your password will not change.</p>`,
    ),
    text: `Reset your Holdria password: ${url}\n\nThis link expires in 1 hour. If you did not request this, you can ignore this message.`,
  };
}

export function passwordChangedEmail(): EmailMessage {
  return {
    to: "",
    subject: "Your Holdria password was changed",
    html: wrap(
      "Your Holdria account password was just changed.",
      `<h1 style="font-size: 18px;">Password changed</h1>
       <p>Your Holdria account password was just changed. If this was you, no action is needed.</p>
       <p>If you did not make this change, reset your password immediately and contact support.</p>`,
    ),
    text: "Your Holdria account password was just changed. If this was not you, reset your password immediately.",
  };
}
